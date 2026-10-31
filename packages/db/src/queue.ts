import {
  expandSchedule,
  runTargets,
  type BotStart,
  type Criterion,
  type RunTarget,
} from '@click-bot/shared';
import { and, asc, count, eq, inArray, isNotNull, isNull, lt, lte, max, or } from 'drizzle-orm';
import type { Database } from './client';
import type { Job } from './jobs';
import { jobs, runSteps, runs, workerHeartbeats } from './schema';

/**
 * The runs table is the job queue: planning inserts `queued` rows, workers claim them with
 * FOR UPDATE SKIP LOCKED, so every run is executed exactly once and its state lives in one place.
 */

export type Run = typeof runs.$inferSelect;
export type ClaimedRun = {
  run: Run;
  job: Pick<
    Job,
    'id' | 'name' | 'customerId' | 'startUrl' | 'flow' | 'analyticsMarking' | 'blockAds'
  >;
};

export type PlanOptions = {
  now: Date;
  /** Queue starts this far ahead, so the worker can pick them up exactly on time. */
  lookaheadMs?: number;
  /** Starts missed by more than this (worker was down) are skipped instead of run late. */
  graceMs?: number;
};

const OPEN = ['queued', 'running'] as const;

async function planJob(db: Database, job: Job, due: BotStart[]): Promise<number> {
  return db.transaction(async (tx) => {
    // Locking the job row serialises concurrent planners for the same job.
    const [locked] = await tx
      .select({
        status: jobs.status,
        runCounter: jobs.runCounter,
        devices: jobs.devices,
        deviceBrowsers: jobs.deviceBrowsers,
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .for('update');
    if (!locked || locked.status !== 'active') return 0;

    const existing = await tx
      .select({
        slotIndex: runs.slotIndex,
        botNr: runs.botNr,
        device: runs.device,
        browser: runs.browser,
      })
      .from(runs)
      .where(and(eq(runs.jobId, job.id), isNotNull(runs.slotIndex)));
    const key = (slot: number | null, bot: number, target: RunTarget) =>
      `${slot}:${bot}:${target.device}:${target.browser}`;
    const planned = new Set(existing.map((r) => key(r.slotIndex, r.botNr, r)));

    const targets = runTargets(locked.devices, locked.deviceBrowsers);
    const missing = due.flatMap((start) =>
      targets
        .filter((target) => !planned.has(key(start.slotIndex, start.botNr, target)))
        .map((target) => ({ start, target })),
    );
    if (missing.length === 0) return 0;

    await tx
      .update(jobs)
      .set({ runCounter: locked.runCounter + missing.length })
      .where(eq(jobs.id, job.id));
    await tx.insert(runs).values(
      missing.map(({ start, target }, i) => ({
        jobId: job.id,
        runNr: locked.runCounter + 1 + i,
        slotIndex: start.slotIndex,
        botNr: start.botNr,
        device: target.device,
        browser: target.browser,
        scheduledAt: start.at,
        status: 'queued' as const,
      })),
    );
    return missing.length;
  });
}

async function finishIfDone(
  db: Database,
  job: Job,
  starts: BotStart[],
  now: Date,
): Promise<boolean> {
  const last = starts.at(-1);
  if (!last || last.at.getTime() > now.getTime()) return false;

  const [open] = await db
    .select({ n: count() })
    .from(runs)
    .where(and(eq(runs.jobId, job.id), inArray(runs.status, OPEN)));
  if ((open?.n ?? 0) > 0) return false;

  const finished = await db
    .update(jobs)
    .set({ status: 'finished', updatedAt: now })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'active')))
    .returning({ id: jobs.id });
  return finished.length > 0;
}

/** Queues due starts of all active jobs and finishes jobs whose schedule is used up. */
export async function planDueRuns(
  db: Database,
  { now, lookaheadMs = 60_000, graceMs = 5 * 60_000 }: PlanOptions,
): Promise<{ created: number; finishedJobs: number }> {
  const active = await db.select().from(jobs).where(eq(jobs.status, 'active'));
  let created = 0;
  let finishedJobs = 0;

  for (const job of active) {
    const starts = expandSchedule(job.schedule);
    const due = starts.filter(
      (start) =>
        start.at.getTime() <= now.getTime() + lookaheadMs &&
        start.at.getTime() >= now.getTime() - graceMs,
    );
    if (due.length > 0) created += await planJob(db, job, due);
    if (await finishIfDone(db, job, starts, now)) finishedJobs += 1;
  }
  return { created, finishedJobs };
}

/**
 * Takes the earliest due run of an active job and marks it running. Several workers can call
 * this at the same time; SKIP LOCKED makes each run go to exactly one of them.
 */
export async function claimNextRun(db: Database, now: Date): Promise<ClaimedRun | null> {
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: runs.id, analyticsMarking: jobs.analyticsMarking, blockAds: jobs.blockAds })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(
        and(
          eq(runs.status, 'queued'),
          lte(runs.scheduledAt, now),
          // Scheduled runs only while the job is active; a test run because someone asked for it.
          or(eq(jobs.status, 'active'), isNull(runs.slotIndex)),
        ),
      )
      .orderBy(asc(runs.scheduledAt), asc(runs.runNr))
      .limit(1)
      .for('update', { of: runs, skipLocked: true });
    if (!next) return null;

    const [run] = await tx
      .update(runs)
      // The run keeps the marking it ran with, even if the job changes later.
      .set({
        status: 'running',
        startedAt: now,
        analyticsMarking: next.analyticsMarking,
        adsBlocked: next.blockAds,
      })
      .where(eq(runs.id, next.id))
      .returning();
    const [job] = await tx
      .select({
        id: jobs.id,
        name: jobs.name,
        customerId: jobs.customerId,
        startUrl: jobs.startUrl,
        flow: jobs.flow,
        analyticsMarking: jobs.analyticsMarking,
        blockAds: jobs.blockAds,
      })
      .from(jobs)
      .where(eq(jobs.id, (run as Run).jobId));
    return { run: run as Run, job: job as ClaimedRun['job'] };
  });
}

export type StepRecord = {
  stepId: string;
  index: number;
  status: 'passed' | 'healed' | 'unclear' | 'failed' | 'skipped';
  durationMs: number;
  /** Must already be masked (no secret values). */
  message: string | null;
  screenshotPath: string | null;
  /** AI step: what the AI did, one line per action. Must already be masked. */
  aiActions?: string[] | null;
  /** AI step: the verdict per sub-goal. Must already be masked. */
  aiVerdict?: Criterion[] | null;
};

export type RunOutcome = {
  status: 'passed' | 'warning' | 'failed';
  finishedAt: Date;
  error?: string | null;
  steps: StepRecord[];
  /** How many requests to ad networks the run blocked. */
  blockedAdRequests?: number;
};

/** Stores the verdict of a running run and its steps in one transaction. */
export async function completeRun(db: Database, runId: string, outcome: RunOutcome): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(runs)
      .set({
        status: outcome.status,
        finishedAt: outcome.finishedAt,
        error: outcome.error ?? null,
        blockedAdRequests: outcome.blockedAdRequests ?? null,
      })
      .where(and(eq(runs.id, runId), eq(runs.status, 'running')))
      .returning({ id: runs.id });
    if (updated.length === 0) throw new Error(`Durchlauf ${runId} läuft nicht (mehr).`);

    if (outcome.steps.length > 0) {
      await tx.insert(runSteps).values(
        outcome.steps.map((step) => ({
          runId,
          stepIndex: step.index,
          stepId: step.stepId,
          status: step.status,
          durationMs: step.durationMs,
          message: step.message,
          screenshotPath: step.screenshotPath,
          aiActions: step.aiActions ?? null,
          aiVerdict: step.aiVerdict ?? null,
        })),
      );
    }
  });
}

/** Fails runs stuck in `running`, e.g. because the worker process died mid-run. */
export async function recoverStaleRuns(
  db: Database,
  { now, staleAfterMs }: { now: Date; staleAfterMs: number },
): Promise<number> {
  const recovered = await db
    .update(runs)
    .set({
      status: 'failed',
      finishedAt: now,
      error: 'Durchlauf abgebrochen: Das Testsystem wurde während des Durchlaufs beendet.',
    })
    .where(
      and(eq(runs.status, 'running'), lt(runs.startedAt, new Date(now.getTime() - staleAfterMs))),
    )
    .returning({ id: runs.id });
  return recovered.length;
}

export async function recordHeartbeat(
  db: Database,
  {
    workerId,
    startedAt,
    now,
    maxBrowsers = null,
  }: { workerId: string; startedAt: Date; now: Date; maxBrowsers?: number | null },
): Promise<void> {
  await db
    .insert(workerHeartbeats)
    .values({ workerId, startedAt, lastSeenAt: now, maxBrowsers })
    .onConflictDoUpdate({
      target: workerHeartbeats.workerId,
      set: { lastSeenAt: now, maxBrowsers },
    });
}

/** Online if any worker reported within `maxAgeMs`. */
export async function getWorkerStatus(
  db: Database,
  now: Date,
  maxAgeMs = 30_000,
): Promise<{ online: boolean; activeRuns: number }> {
  const [heartbeat] = await db
    .select({ last: max(workerHeartbeats.lastSeenAt) })
    .from(workerHeartbeats);
  const [running] = await db.select({ n: count() }).from(runs).where(eq(runs.status, 'running'));
  const last = heartbeat?.last ?? null;
  return {
    online: last !== null && now.getTime() - last.getTime() <= maxAgeMs,
    activeRuns: running?.n ?? 0,
  };
}
