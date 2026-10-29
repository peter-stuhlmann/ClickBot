import { and, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from './client';
import { isUuid } from './ids';
import type { Browser, Device } from './jobs';
import { customers, jobs, runs } from './schema';

type RunStatus = (typeof runs.$inferSelect)['status'];

export type RunFilter = {
  customerId?: string;
  statuses?: RunStatus[];
  /** Runs scheduled at or after this instant. */
  since?: Date;
  device?: Device;
  limit?: number;
  offset?: number;
};

export type RunListRow = {
  id: string;
  runNr: number;
  /** Null for a test run. */
  slotIndex: number | null;
  botNr: number;
  device: Device;
  browser: Browser;
  status: RunStatus;
  scheduledAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  jobId: string;
  jobName: string;
  customerName: string;
};

/** Screen 14 "Läufe": runs of all jobs, newest first, with the total for paging. */
export async function listRuns(
  db: Database,
  filter: RunFilter,
): Promise<{ rows: RunListRow[]; total: number }> {
  if (filter.customerId !== undefined && !isUuid(filter.customerId)) return { rows: [], total: 0 };

  const conditions: SQL[] = [];
  if (filter.customerId) conditions.push(eq(jobs.customerId, filter.customerId));
  if (filter.statuses?.length) conditions.push(inArray(runs.status, filter.statuses));
  if (filter.since) conditions.push(gte(runs.scheduledAt, filter.since));
  if (filter.device) conditions.push(eq(runs.device, filter.device));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: runs.id,
        runNr: runs.runNr,
        slotIndex: runs.slotIndex,
        botNr: runs.botNr,
        device: runs.device,
        browser: runs.browser,
        status: runs.status,
        scheduledAt: runs.scheduledAt,
        startedAt: runs.startedAt,
        finishedAt: runs.finishedAt,
        jobId: jobs.id,
        jobName: jobs.name,
        customerName: customers.name,
      })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .innerJoin(customers, eq(customers.id, jobs.customerId))
      .where(where)
      .orderBy(desc(runs.scheduledAt), desc(runs.runNr))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(where),
  ]);
  return { rows, total: count?.total ?? 0 };
}
