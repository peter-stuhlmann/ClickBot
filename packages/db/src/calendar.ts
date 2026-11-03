import { localToUtc, scheduleSchema, type DeviceBrowsers, type Schedule } from '@click-bot/shared';
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError, ValidationError, issuesFromZod } from './errors';
import { isUuid } from './ids';
import { SLOT_FIXED, type Device } from './jobs';
import { FINISHED } from './overview';
import { customers, jobs, runs, workerHeartbeats } from './schema';

/** How far back the typical length of a run looks. */
const DURATION_WINDOW_MS = 30 * 86_400_000;

export type CalendarJob = {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  schedule: Schedule;
  devices: Device[];
  deviceBrowsers: DeviceBrowsers;
  /** Median length of its finished runs in the last 30 days; null without any. */
  typicalRunMs: number | null;
};

/**
 * The jobs whose starts the calendar shows, of every project: the browsers of the worker are
 * shared, so the load counts them all. Drafts and paused jobs start nothing.
 */
export async function listCalendarJobs(db: Database, now: Date): Promise<CalendarJob[]> {
  const since = new Date(now.getTime() - DURATION_WINDOW_MS);
  const typical = db
    .select({
      jobId: runs.jobId,
      ms: sql<number>`percentile_cont(0.5) within group (order by extract(epoch from ${runs.finishedAt} - ${runs.startedAt}) * 1000)`.as(
        'ms',
      ),
    })
    .from(runs)
    .where(
      and(
        inArray(runs.status, FINISHED),
        isNotNull(runs.startedAt),
        isNotNull(runs.finishedAt),
        gte(runs.finishedAt, since),
      ),
    )
    .groupBy(runs.jobId)
    .as('typical');

  const rows = await db
    .select({ job: jobs, customerName: customers.name, typicalRunMs: typical.ms })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .leftJoin(typical, eq(typical.jobId, jobs.id))
    .where(inArray(jobs.status, ['active', 'finished']))
    .orderBy(asc(jobs.createdAt), asc(jobs.id));

  return rows.map(({ job, customerName, typicalRunMs }) => ({
    id: job.id,
    name: job.name,
    customerId: job.customerId,
    customerName,
    schedule: job.schedule,
    devices: job.devices,
    deviceBrowsers: job.deviceBrowsers,
    typicalRunMs: typicalRunMs === null ? null : Math.round(Number(typicalRunMs)),
  }));
}

export type SlotMove = {
  slotIndex: number;
  /** The date as the caller saw it; if it changed in the meantime, nothing is moved. */
  from: { date: string; time: string };
  to: { date: string; time: string };
};

const refuse = (path: string, message: string) => new ValidationError([{ path, message }]);

/**
 * Moves one date of a plan by dates, e.g. a suggestion of the calendar to spread the load. Only
 * dates without runs and only into the future; everything else of the job stays as it is.
 */
export async function moveSlot(
  db: Database,
  jobId: string,
  move: SlotMove,
  now: Date,
): Promise<void> {
  if (!isUuid(jobId)) throw new NotFoundError('Test', jobId);
  await db.transaction(async (tx) => {
    // Same row lock as the planner: no start is planned from a half-changed schedule.
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId)).for('update');
    if (!job) throw new NotFoundError('Test', jobId);
    const { schedule } = job;
    const path = `schedule.slots.${move.slotIndex}`;
    if (schedule.type !== 'times') {
      throw refuse('schedule.type', 'Nur Termine lassen sich einzeln verschieben.');
    }
    const slot = schedule.slots[move.slotIndex];
    if (!slot || slot.date !== move.from.date || slot.time !== move.from.time) {
      throw refuse(path, 'Der Termin hat sich inzwischen geändert. Bitte die Seite neu laden.');
    }

    const [started] = await tx
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.jobId, jobId), eq(runs.slotIndex, move.slotIndex)))
      .limit(1);
    if (started) throw refuse(path, SLOT_FIXED);

    const at = localToUtc(move.to.date, move.to.time, schedule.timezone);
    if (at && at.getTime() <= now.getTime()) {
      throw refuse(path, 'Der neue Termin liegt nicht in der Zukunft.');
    }
    const slots = schedule.slots.map((other, index) =>
      index === move.slotIndex ? { ...other, ...move.to } : other,
    );
    const parsed = scheduleSchema.safeParse({ ...schedule, slots });
    if (!parsed.success) throw new ValidationError(issuesFromZod('schedule', parsed.error));

    await tx
      .update(jobs)
      .set({ schedule: parsed.data, updatedAt: sql`now()` })
      .where(eq(jobs.id, jobId));
  });
}

/** How many browsers the worker that reported last runs at once; null if none said so. */
export async function getBrowserLimit(db: Database): Promise<number | null> {
  const [latest] = await db
    .select({ maxBrowsers: workerHeartbeats.maxBrowsers })
    .from(workerHeartbeats)
    .orderBy(desc(workerHeartbeats.lastSeenAt))
    .limit(1);
  return latest?.maxBrowsers ?? null;
}
