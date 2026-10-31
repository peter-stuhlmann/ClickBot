import type { Flow } from '@click-bot/shared';
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError } from './errors';
import { isUuid } from './ids';
import { getJob, plannedRunCount } from './jobs';
import { FINISHED } from './overview';
import type { Run } from './queue';
import { runSteps, runs } from './schema';

export type RunStepRow = Pick<
  typeof runSteps.$inferSelect,
  'stepIndex' | 'stepId' | 'status' | 'durationMs' | 'message' | 'screenshotPath' | 'aiActions'
>;

export type RunReport = {
  run: Run;
  job: { id: string; name: string; startUrl: string; flow: Flow; runsPlanned: number };
  /** Results in flow order; empty while the run has not finished. */
  steps: RunStepRow[];
  /** Mean duration of the job's finished runs in ms, for comparison; null without any. */
  averageDurationMs: number | null;
};

/** Everything the run report (screen 03) shows about one run. */
export async function getRunReport(db: Database, runId: string): Promise<RunReport> {
  const run = isUuid(runId) ? await db.query.runs.findFirst({ where: eq(runs.id, runId) }) : null;
  if (!run) throw new NotFoundError('Lauf', runId);

  const [job, steps, [average]] = await Promise.all([
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
  };
}
