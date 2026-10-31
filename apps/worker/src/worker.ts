import {
  claimNextRun,
  getAiConfig,
  claimPageAnalysis,
  completePageAnalysis,
  completeRun,
  planDueRuns,
  recordHeartbeat,
  resolveSecretsForRun,
  type Browser,
  type Cipher,
  type ClaimedRun,
  type Database,
  type Device,
  type PlanOptions,
} from '@click-bot/db';
import { createAiClient, nextAgentAction, type AiClient, type AiConfig } from '@click-bot/ai';
import type { BrowserContext } from 'playwright';
import type { AgentDriver } from './ai-step';
import type { ArtifactStore } from './artifacts';
import { toStepMessage } from './errors';
import { analysePage } from './page-analysis';
import { runFlow } from './run-flow';

export type WorkerDeps = {
  db: Database;
  cipher: Cipher;
  /** A fresh, isolated browser context per run, in the run's browser, set up for its device. */
  newContext: (device: Device, browser: Browser) => Promise<BrowserContext>;
  artifacts: ArtifactStore;
  /** Upper limit of browsers running at the same time (MAX_CONCURRENT_BROWSERS). */
  maxConcurrent: number;
  workerId: string;
  /** Talks to the AI provider of AI steps; tests replace it. */
  createAiClient?: (config: AiConfig) => AiClient;
  clock?: () => Date;
  planning?: Omit<PlanOptions, 'now'>;
  log?: (message: string) => void;
};

export type Worker = {
  /** One round: queue due starts, then start runs while browser slots are free. */
  tick(): Promise<string[]>;
  heartbeat(): Promise<void>;
  activeRuns(): number;
  /** Resolves when all runs started so far have finished. */
  idle(): Promise<void>;
  /** Starts nothing new and waits for the running runs. */
  stop(): Promise<void>;
};

/**
 * The AI for the AI steps of a flow: the default provider, read for each run so a changed key
 * applies right away. Undefined without AI steps or without a provider; the step then says so.
 */
async function agentFor(
  deps: WorkerDeps,
  steps: readonly { type: string }[],
): Promise<AgentDriver | undefined> {
  if (!steps.some((step) => step.type === 'ai')) return undefined;
  const config = await getAiConfig(deps.db, deps.cipher);
  if (!config) return undefined;
  const client = (deps.createAiClient ?? createAiClient)(config);
  return (input) => nextAgentAction(client, input);
}

async function executeRun(deps: WorkerDeps, { run, job }: ClaimedRun): Promise<void> {
  const now = deps.clock ?? (() => new Date());
  let context: BrowserContext | undefined;
  try {
    context = await deps.newContext(run.device, run.browser);
    const secrets = await resolveSecretsForRun(deps.db, deps.cipher, {
      customerId: job.customerId,
      url: job.startUrl,
      now: now(),
    });
    const result = await runFlow(context, job.flow, {
      ai: await agentFor(deps, job.flow.steps),
      baseUrl: job.startUrl,
      runNr: run.runNr,
      botNr: run.botNr,
      secrets,
      analyticsMarking: job.analyticsMarking,
      blockAds: job.blockAds,
    });

    const screenshots = new Map<string, string>();
    for (const shot of result.screenshots) {
      const index = result.steps.find((step) => step.stepId === shot.stepId)?.index ?? 0;
      screenshots.set(
        shot.stepId,
        await deps.artifacts.saveScreenshot(run.id, index, shot.stepId, shot.image),
      );
    }

    await completeRun(deps.db, run.id, {
      status: result.status,
      finishedAt: now(),
      error: result.steps.find((step) => step.status === 'failed')?.message ?? null,
      steps: result.steps.map((step) => ({
        stepId: step.stepId,
        index: step.index,
        status: step.status,
        durationMs: step.durationMs,
        message: step.message ?? null,
        screenshotPath: screenshots.get(step.stepId) ?? null,
        aiActions: step.aiActions ?? null,
      })),
      blockedAdRequests: result.blockedAdRequests,
    });
  } catch (error) {
    // Anything outside the flow itself (secrets, browser, storage) still ends the run cleanly.
    await completeRun(deps.db, run.id, {
      status: 'failed',
      finishedAt: now(),
      error: `Lauf konnte nicht ausgeführt werden: ${toStepMessage(error)}`,
      steps: [],
    }).catch((reason: unknown) => deps.log?.(`Lauf ${run.id}: ${toStepMessage(reason)}`));
  } finally {
    await context?.close().catch(() => undefined);
  }
}

/** "Mit KI beschreiben": opens the start page once on a desktop in Chromium and stores the facts. */
async function executeAnalysis(deps: WorkerDeps, { id, url }: { id: string; url: string }) {
  const now = deps.clock ?? (() => new Date());
  let context: BrowserContext | undefined;
  try {
    context = await deps.newContext('desktop', 'chromium');
    const facts = await analysePage(context, url);
    await completePageAnalysis(deps.db, id, { facts }, now());
  } catch (error) {
    await completePageAnalysis(deps.db, id, { error: toStepMessage(error) }, now()).catch(
      (reason: unknown) => deps.log?.(`Seitenanalyse ${id}: ${toStepMessage(reason)}`),
    );
  } finally {
    await context?.close().catch(() => undefined);
  }
}

export function createWorker(deps: WorkerDeps): Worker {
  const now = deps.clock ?? (() => new Date());
  const startedAt = now();
  const active = new Set<Promise<void>>();
  let stopping = false;

  return {
    async tick() {
      if (stopping) return [];
      await planDueRuns(deps.db, { now: now(), ...deps.planning });

      const started: string[] = [];
      const track = (execution: Promise<void>) => {
        const tracked = execution.finally(() => active.delete(tracked));
        active.add(tracked);
      };
      // A user waits for a page analysis, so it goes before scheduled runs.
      while (!stopping && active.size < deps.maxConcurrent) {
        const analysis = await claimPageAnalysis(deps.db, now());
        if (!analysis) break;
        track(executeAnalysis(deps, analysis));
      }
      while (!stopping && active.size < deps.maxConcurrent) {
        const claimed = await claimNextRun(deps.db, now());
        if (!claimed) break;
        track(executeRun(deps, claimed));
        started.push(claimed.run.id);
      }
      return started;
    },

    async heartbeat() {
      await recordHeartbeat(deps.db, {
        workerId: deps.workerId,
        startedAt,
        now: now(),
        maxBrowsers: deps.maxConcurrent,
      });
    },

    activeRuns: () => active.size,

    async idle() {
      while (active.size > 0) await Promise.all([...active]);
    },

    async stop() {
      stopping = true;
      await this.idle();
    },
  };
}
