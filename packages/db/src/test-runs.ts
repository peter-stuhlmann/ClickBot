import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError } from './errors';
import { isUuid } from './ids';
import { allocateRunNumber } from './jobs';
import { jobs, runs } from './schema';

/**
 * "Testlauf starten" in the editor: one bot on the first device of the job, due now and outside
 * the schedule (no slot). While a test run of the job is still waiting or running, that one is
 * returned instead, so repeated clicks never pile up runs.
 */
export async function queueTestRun(
  db: Database,
  jobId: string,
  now: Date,
): Promise<{ runId: string; existing: boolean }> {
  if (!isUuid(jobId)) throw new NotFoundError('Job', jobId);
  return db.transaction(async (tx) => {
    // Serialises concurrent clicks: the second one sees the run of the first.
    const [job] = await tx
      .select({ id: jobs.id, devices: jobs.devices })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .for('update');
    if (!job) throw new NotFoundError('Job', jobId);

    const [open] = await tx
      .select({ id: runs.id })
      .from(runs)
      .where(
        and(
          eq(runs.jobId, jobId),
          isNull(runs.slotIndex),
          inArray(runs.status, ['queued', 'running']),
        ),
      )
      .limit(1);
    if (open) return { runId: open.id, existing: true };

    const runNr = await allocateRunNumber(tx, jobId);
    const [run] = await tx
      .insert(runs)
      .values({
        jobId,
        runNr,
        slotIndex: null,
        botNr: 1,
        device: job.devices[0] ?? 'desktop',
        status: 'queued',
        scheduledAt: now,
      })
      .returning({ id: runs.id });
    return { runId: (run as { id: string }).id, existing: false };
  });
}
