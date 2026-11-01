import { runTargets } from '@click-bot/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError } from './errors';
import { isUuid } from './ids';
import { allocateRunNumber } from './jobs';
import { jobs, runs } from './schema';

export type TestRunBatch = {
  /** The first run of the start, e.g. to open its report. */
  runId: string;
  /** Every run of the start, in the order they were queued. */
  runIds: string[];
  /** A start of this job was still waiting or running; that one is returned instead. */
  existing: boolean;
};

/**
 * "Jetzt ausführen": one run on every device and browser of the job, due now and outside the
 * schedule (no slot). The runs share the moment they were queued, which makes them one start
 * (see getWaveReport). While a test run of the job is still waiting or running, that start is
 * returned instead, so repeated clicks never pile up runs.
 */
export async function queueTestRun(db: Database, jobId: string, now: Date): Promise<TestRunBatch> {
  if (!isUuid(jobId)) throw new NotFoundError('Test', jobId);
  return db.transaction(async (tx) => {
    // Serialises concurrent clicks: the second one sees the runs of the first.
    const [job] = await tx
      .select({ id: jobs.id, devices: jobs.devices, deviceBrowsers: jobs.deviceBrowsers })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for('update');
    if (!job) throw new NotFoundError('Test', jobId);

    const [open] = await tx
      .select({ scheduledAt: runs.scheduledAt })
      .from(runs)
      .where(
        and(
          eq(runs.jobId, jobId),
          isNull(runs.slotIndex),
          inArray(runs.status, ['queued', 'running']),
        ),
      )
      .limit(1);
    if (open) {
      // The whole start, finished runs of it included.
      const siblings = await tx
        .select({ id: runs.id })
        .from(runs)
        .where(
          and(
            eq(runs.jobId, jobId),
            isNull(runs.slotIndex),
            eq(runs.scheduledAt, open.scheduledAt),
          ),
        )
        .orderBy(asc(runs.runNr));
      const runIds = siblings.map((run) => run.id);
      return { runId: runIds[0] as string, runIds, existing: true };
    }

    const targets = runTargets(job.devices, job.deviceBrowsers);
    if (targets.length === 0) targets.push({ device: 'desktop', browser: 'chromium' });
    const runIds: string[] = [];
    for (const target of targets) {
      const runNr = await allocateRunNumber(tx, jobId);
      const [run] = await tx
        .insert(runs)
        .values({
          jobId,
          runNr,
          slotIndex: null,
          botNr: 1,
          device: target.device,
          browser: target.browser,
          status: 'queued',
          scheduledAt: now,
        })
        .returning({ id: runs.id });
      runIds.push((run as { id: string }).id);
    }
    return { runId: runIds[0] as string, runIds, existing: false };
  });
}
