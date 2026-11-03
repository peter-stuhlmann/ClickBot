import {
  claimNextRun,
  getAiConfig,
  completeRun,
  planDueRuns,
  recordHeartbeat,
  resolveSecretsForRun,
  type Browser,
  type Cipher,
  type ClaimedRun,
  type Database,
  type Device,
  type ModelUsage,
  type PlanOptions,
  type VideoCue,
} from '@click-bot/db';
import {
  createAiClient,
  nextAgentAction,
  type AiClient,
  type AiConfig,
  type AiDeps,
} from '@click-bot/ai';
import { addUsage, hasUsage, NO_USAGE } from '@click-bot/shared';
import { rm } from 'node:fs/promises';
import type { BrowserContext } from 'playwright';
import type { AgentDriver } from './ai-step';
import type { ArtifactStore } from './artifacts';
import { toStepMessage } from './errors';
import { runFlow, type RunResult } from './run-flow';
import { createRunWatchRegistry, type RunTap, type RunWatchRegistry } from './run-watch';
import { recordRun, type VideoRecorder } from './video';

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
  createAiClient?: (config: AiConfig, deps?: AiDeps) => AiClient;
  clock?: () => Date;
  planning?: Omit<PlanOptions, 'now'>;
  /** Runs that can be watched live while they go ("Live zuschauen"), and recorded as video. */
  watch?: RunWatchRegistry;
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

/** The AI of a run: the driver for its AI steps, and what it has used so far. */
type RunAi = { driver: AgentDriver; usage(): ModelUsage | null };

/**
 * The AI for the AI steps of a flow: the default provider, read for each run so a changed key
 * applies right away. Undefined without AI steps or without a provider; the step then says so.
 * The tokens of every answer are added up for the cost of the run.
 */
async function agentFor(
  deps: WorkerDeps,
  steps: readonly { type: string }[],
): Promise<RunAi | undefined> {
  if (!steps.some((step) => step.type === 'ai')) return undefined;
  const config = await getAiConfig(deps.db, deps.cipher);
  if (!config) return undefined;
  let total = NO_USAGE;
  const client = (deps.createAiClient ?? createAiClient)(config, {
    onUsage: (usage) => {
      total = addUsage(total, usage);
    },
  });
  return {
    driver: (input) => nextAgentAction(client, input),
    usage: () =>
      hasUsage(total) ? { provider: config.kind, model: config.model, usage: total } : null,
  };
}

/**
 * The MP4 of a recorded run, stored next to its screenshots. A video that fails is left out; the
 * run keeps its verdict and the log says why.
 */
async function saveVideo(
  deps: WorkerDeps,
  runId: string,
  recorder: VideoRecorder,
): Promise<{ videoPath: string; videoCues: VideoCue[] } | null> {
  try {
    const recording = await recorder.stop();
    if (!recording) return null;
    return {
      videoPath: await deps.artifacts.saveVideo(runId, recording),
      videoCues: recording.cues,
    };
  } catch (error) {
    deps.log?.(`Video von Durchlauf ${runId}: ${toStepMessage(error)}`);
    return null;
  }
}

async function executeRun(
  deps: WorkerDeps & { watch: RunWatchRegistry },
  { run, job }: ClaimedRun,
): Promise<void> {
  const now = deps.clock ?? (() => new Date());
  let context: BrowserContext | undefined;
  let tap: RunTap | undefined;
  let recorder: VideoRecorder | null = null;
  let result: RunResult | undefined;
  let ai: RunAi | undefined;
  try {
    context = await deps.newContext(run.device, run.browser);
    const secrets = await resolveSecretsForRun(deps.db, deps.cipher, {
      customerId: job.customerId,
      url: job.startUrl,
      now: now(),
    });
    tap = deps.watch.start(run.id, {
      engine: run.browser,
      secrets: Object.values(secrets),
      total: job.flow.steps.length,
    });
    // Test runs always, the runs of the schedule when the job asks for it.
    const watched = deps.watch.find(run.id);
    if (watched && (job.recordVideo || run.slotIndex === null)) {
      recorder = await recordRun(watched).catch((error: unknown) => {
        deps.log?.(`Video von Durchlauf ${run.id}: ${toStepMessage(error)}`);
        return null;
      });
    }
    ai = await agentFor(deps, job.flow.steps);
    result = await runFlow(context, job.flow, {
      tap,
      ai: ai?.driver,
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

    const video = recorder ? await saveVideo(deps, run.id, recorder) : null;
    recorder = null;

    await completeRun(deps.db, run.id, {
      ...video,
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
        aiVerdict: step.aiVerdict ?? null,
        aiSummary: step.aiSummary ?? null,
      })),
      blockedAdRequests: result.blockedAdRequests,
      aiUsage: ai?.usage() ?? null,
    });
  } catch (error) {
    // Anything outside the flow itself (secrets, browser, storage) still ends the run cleanly.
    await completeRun(deps.db, run.id, {
      status: 'failed',
      finishedAt: now(),
      error: `Durchlauf konnte nicht ausgeführt werden: ${toStepMessage(error)}`,
      steps: [],
      // Tokens already used are billed, whatever happened after.
      aiUsage: ai?.usage() ?? null,
    }).catch((reason: unknown) => deps.log?.(`Durchlauf ${run.id}: ${toStepMessage(reason)}`));
  } finally {
    // Stopped without a video when the run could not be completed.
    await recorder
      ?.stop()
      .then((recording) => recording && rm(recording.dir, { recursive: true, force: true }))
      .catch(() => undefined);
    tap?.end(result?.status ?? 'failed');
    await context?.close().catch(() => undefined);
  }
}

export function createWorker(options: WorkerDeps): Worker {
  // Recording a video follows a run like a watcher: without a registry, one of its own.
  const deps = { ...options, watch: options.watch ?? createRunWatchRegistry() };
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
