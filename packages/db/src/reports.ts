import type { Flow } from '@click-bot/shared';
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError } from './errors';
import { isUuid } from './ids';
import { getJob, plannedRunCount } from './jobs';
import { FINISHED } from './overview';
import type { Run } from './queue';
import { runSteps, runs } from './schema';

export type RunStepRow = Pick<
  typeof runSteps.$inferSelect,
  | 'stepIndex'
  | 'stepId'
  | 'status'
  | 'durationMs'
  | 'message'
  | 'screenshotPath'
  | 'aiActions'
  | 'aiVerdict'
  | 'aiSummary'
>;

export type RunReport = {
  run: Run;
  job: { id: string; name: string; startUrl: string; flow: Flow; runsPlanned: number };
  /** Results in flow order; empty while the run has not finished. */
  steps: RunStepRow[];
  /** Mean duration of the job's finished runs in ms, for comparison; null without any. */
  averageDurationMs: number | null;
  /** How many runs belong to the same start (every device and browser of it), this one included. */
  waveSize: number;
};

/**
 * The runs of one start ("Welle"): a slot of the schedule on every device and browser, or the
 * test runs queued together by "Jetzt ausführen" (no slot; they share the moment they were queued).
 */
function sameWave(run: Pick<Run, 'jobId' | 'slotIndex' | 'scheduledAt'>) {
  return and(
    eq(runs.jobId, run.jobId),
    run.slotIndex === null
      ? and(isNull(runs.slotIndex), eq(runs.scheduledAt, run.scheduledAt))
      : eq(runs.slotIndex, run.slotIndex),
  );
}

async function findRun(db: Database, runId: string): Promise<Run> {
  const run = isUuid(runId) ? await db.query.runs.findFirst({ where: eq(runs.id, runId) }) : null;
  if (!run) throw new NotFoundError('Durchlauf', runId);
  return run;
}

/** Everything the run report (screen 03) shows about one run. */
export async function getRunReport(db: Database, runId: string): Promise<RunReport> {
  const run = await findRun(db, runId);

  const [job, steps, [average], [wave]] = await Promise.all([
    getJob(db, run.jobId),
    db
      .select({
        stepIndex: runSteps.stepIndex,
        stepId: runSteps.stepId,
        status: runSteps.status,
        durationMs: runSteps.durationMs,
        message: runSteps.message,
        screenshotPath: runSteps.screenshotPath,
        aiActions: runSteps.aiActions,
        aiVerdict: runSteps.aiVerdict,
        aiSummary: runSteps.aiSummary,
      })
      .from(runSteps)
      .where(eq(runSteps.runId, run.id))
      .orderBy(asc(runSteps.stepIndex)),
    db
      .select({
        ms: sql<
          string | null
        >`avg(extract(epoch from ${runs.finishedAt} - ${runs.startedAt}) * 1000)`,
      })
      .from(runs)
      .where(
        and(
          eq(runs.jobId, run.jobId),
          inArray(runs.status, FINISHED),
          isNotNull(runs.startedAt),
          isNotNull(runs.finishedAt),
        ),
      ),
    db
      .select({ size: sql<number>`count(*)`.mapWith(Number) })
      .from(runs)
      .where(sameWave(run)),
  ]);

  return {
    run,
    job: {
      id: job.id,
      name: job.name,
      startUrl: job.startUrl,
      flow: job.flow,
      runsPlanned: plannedRunCount(job),
    },
    steps,
    averageDurationMs: average?.ms == null ? null : Math.round(Number(average.ms)),
    waveSize: wave?.size ?? 1,
  };
}

export type WaveRun = Pick<
  Run,
  | 'id'
  | 'runNr'
  | 'botNr'
  | 'device'
  | 'browser'
  | 'status'
  | 'scheduledAt'
  | 'startedAt'
  | 'finishedAt'
  | 'error'
> & {
  /** The step the run stopped at, with its message; null unless a step failed. */
  failedStep: { stepIndex: number; stepId: string; message: string | null } | null;
};

export type WaveReport = {
  job: { id: string; name: string };
  flow: Flow;
  /** Queued by "Jetzt ausführen" rather than by the schedule. */
  manual: boolean;
  /** When the start was due: the earliest run of it. */
  scheduledAt: Date;
  /** In the order they were queued: device by device, browser by browser. */
  runs: WaveRun[];
};

/** Screen 03b "Welle-Report": every run of the start `runId` belongs to, side by side. */
export async function getWaveReport(db: Database, runId: string): Promise<WaveReport> {
  const run = await findRun(db, runId);
  const [job, rows] = await Promise.all([
    getJob(db, run.jobId),
    // A run stops at its first failed step, so there is at most one failed step per run.
    db
      .select({
        id: runs.id,
        runNr: runs.runNr,
        botNr: runs.botNr,
        device: runs.device,
        browser: runs.browser,
        status: runs.status,
        scheduledAt: runs.scheduledAt,
        startedAt: runs.startedAt,
        finishedAt: runs.finishedAt,
        error: runs.error,
        failedIndex: runSteps.stepIndex,
        failedId: runSteps.stepId,
        failedMessage: runSteps.message,
      })
      .from(runs)
      .leftJoin(runSteps, and(eq(runSteps.runId, runs.id), eq(runSteps.status, 'failed')))
      .where(sameWave(run))
      .orderBy(asc(runs.runNr)),
  ]);

  return {
    job: { id: job.id, name: job.name },
    flow: job.flow,
    manual: run.slotIndex === null,
    scheduledAt: rows.reduce(
      (earliest, row) => (row.scheduledAt < earliest ? row.scheduledAt : earliest),
      run.scheduledAt,
    ),
    runs: rows.map(({ failedIndex, failedId, failedMessage, ...row }) => ({
      ...row,
      failedStep:
        failedIndex === null || failedId === null
          ? null
          : { stepIndex: failedIndex, stepId: failedId, message: failedMessage },
    })),
  };
}
