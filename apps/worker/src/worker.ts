import {
  claimNextRun,
  completeRun,
  planDueRuns,
  recordHeartbeat,
  resolveSecretsForRun,
  type Cipher,
  type ClaimedRun,
  type Database,
  type Device,
  type PlanOptions,
} from '@click-bot/db';
import type { BrowserContext } from 'playwright';
import type { ArtifactStore } from './artifacts';
import { toStepMessage } from './errors';
import { runFlow } from './run-flow';

export type WorkerDeps = {
  db: Database;
  cipher: Cipher;
  /** A fresh, isolated browser context per run, set up for the run's device. */
  newContext: (device: Device) => Promise<BrowserContext>;
  artifacts: ArtifactStore;
  /** Upper limit of browsers running at the same time (MAX_CONCURRENT_BROWSERS). */
  maxConcurrent: number;
  workerId: string;
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

async function executeRun(deps: WorkerDeps, { run, job }: ClaimedRun): Promise<void> {
  const now = deps.clock ?? (() => new Date());
  let context: BrowserContext | undefined;
  try {
    context = await deps.newContext(run.device);
    const secrets = await resolveSecretsForRun(deps.db, deps.cipher, {
      customerId: job.customerId,
      url: job.startUrl,
      now: now(),
    });
    const result = await runFlow(context, job.flow, {
      baseUrl: job.startUrl,
      runNr: run.runNr,
      botNr: run.botNr,
      secrets,
      analyticsMarking: job.analyticsMarking,
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
      })),
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
      while (!stopping && active.size < deps.maxConcurrent) {
        const claimed = await claimNextRun(deps.db, now());
        if (!claimed) break;
        const execution = executeRun(deps, claimed).finally(() => active.delete(execution));
        active.add(execution);
        started.push(claimed.run.id);
      }
      return started;
    },

    async heartbeat() {
      await recordHeartbeat(deps.db, { workerId: deps.workerId, startedAt, now: now() });
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
