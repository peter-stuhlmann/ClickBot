import {
  expandSchedule,
  flowSchema,
  scheduleSchema,
  type Flow,
  type Schedule,
} from '@click-bot/shared';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './client';
import { NotFoundError, ValidationError, issuesFromZod, type ValidationIssue } from './errors';
import { isUuid } from './ids';
import { customers, device, jobs, runs } from './schema';

export type Job = typeof jobs.$inferSelect;
export type Device = (typeof device.enumValues)[number];

export type NewJobInput = {
  customerId: string;
  name: string;
  startUrl: string;
  /** Untrusted input, validated with flowSchema. */
  flow: unknown;
  /** Untrusted input, validated with scheduleSchema. */
  schedule: unknown;
  devices?: Device[];
  /** "active" lets the planner pick the job up right away. Default: draft. */
  status?: 'draft' | 'active';
};

async function checkCustomer(db: Database, customerId: string): Promise<ValidationIssue | null> {
  if (customerId === '') return { path: 'customerId', message: 'Bitte einen Kunden wählen.' };
  const exists =
    isUuid(customerId) &&
    (await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
      columns: { id: true },
    }));
  return exists ? null : { path: 'customerId', message: 'Kunde nicht gefunden.' };
}

const startUrlSchema = z.string().refine((value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Start-URL muss mit http:// oder https:// beginnen.');

const devicesSchema = z.array(z.enum(device.enumValues)).min(1, 'Mindestens ein Gerät wählen.');

type JobFields = {
  name: string;
  startUrl: string;
  flow: Flow;
  schedule: Schedule;
  devices: Device[];
};

/** Checks the editable fields of a job; adds problems to `issues`, returns null if any. */
function validateFields(
  input: { name: string; startUrl: string; flow: unknown; schedule: unknown; devices?: Device[] },
  issues: ValidationIssue[],
): JobFields | null {
  const name = input.name.trim();
  if (!name) issues.push({ path: 'name', message: 'Name fehlt.' });

  const startUrl = startUrlSchema.safeParse(input.startUrl);
  if (!startUrl.success) issues.push(...issuesFromZod('startUrl', startUrl.error));

  const devices = devicesSchema.safeParse([...new Set(input.devices ?? ['desktop'])]);
  if (!devices.success) issues.push(...issuesFromZod('devices', devices.error));

  const flow = flowSchema.safeParse(input.flow);
  if (!flow.success) issues.push(...issuesFromZod('flow', flow.error));

  const schedule = scheduleSchema.safeParse(input.schedule);
  if (!schedule.success) issues.push(...issuesFromZod('schedule', schedule.error));

  if (!name || !startUrl.success || !devices.success || !flow.success || !schedule.success) {
    return null;
  }
  return {
    name,
    startUrl: startUrl.data,
    flow: flow.data,
    schedule: schedule.data,
    devices: devices.data,
  };
}

/** Validates everything first and reports all problems at once; writes nothing if one fails. */
export async function createJob(db: Database, input: NewJobInput): Promise<Job> {
  const issues: ValidationIssue[] = [];
  const customerIssue = await checkCustomer(db, input.customerId);
  if (customerIssue) issues.push(customerIssue);
  const fields = validateFields(input, issues);
  if (customerIssue || !fields) throw new ValidationError(issues);

  const [job] = await db
    .insert(jobs)
    .values({ customerId: input.customerId, ...fields, status: input.status ?? 'draft' })
    .returning();
  return job as Job;
}

export type JobUpdateInput = {
  name: string;
  startUrl: string;
  /** Untrusted input, validated with flowSchema. */
  flow: unknown;
  /** Untrusted input, validated with scheduleSchema. */
  schedule: unknown;
  devices: Device[];
};

/** Slots (times) and interval starts that already have runs, by position, in order. */
export async function listStartedSlots(db: Database, jobId: string): Promise<number[]> {
  const rows = await db
    .selectDistinct({ slotIndex: runs.slotIndex })
    .from(runs)
    .where(and(eq(runs.jobId, jobId), isNotNull(runs.slotIndex)))
    .orderBy(asc(runs.slotIndex));
  return rows.map((row) => row.slotIndex as number);
}

const SLOT_FIXED =
  'Dieser Termin hat schon Läufe und lässt sich nicht mehr verschieben oder löschen.';
const TYPE_FIXED =
  'Die Art des Zeitplans lässt sich nicht mehr ändern, weil der Job schon Läufe hat.';

/**
 * The planner recognises done starts by their position (runs.slot_index). Once a date has runs,
 * moving or removing it would make the planner skip or repeat starts, so it stays as it is.
 * An interval just continues with the next position, so it may change freely.
 */
function startedScheduleIssues(
  started: number[],
  before: Schedule,
  after: Schedule,
): ValidationIssue[] {
  if (started.length === 0) return [];
  if (before.type !== after.type) return [{ path: 'schedule.type', message: TYPE_FIXED }];
  if (before.type !== 'times' || after.type !== 'times') return [];
  return started
    .filter((index) => {
      const old = before.slots[index];
      const next = after.slots[index];
      return old && (!next || next.date !== old.date || next.time !== old.time);
    })
    .map((index) => ({ path: `schedule.slots.${index}`, message: SLOT_FIXED }));
}

/** Saves the editor (screen 02). The status stays as it is. */
export async function updateJob(db: Database, jobId: string, input: JobUpdateInput): Promise<Job> {
  if (!isUuid(jobId)) throw new NotFoundError('Job', jobId);
  return db.transaction(async (tx) => {
    // Same row lock as the planner: no start is planned from a half-changed schedule.
    const [current] = await tx.select().from(jobs).where(eq(jobs.id, jobId)).for('update');
    if (!current) throw new NotFoundError('Job', jobId);

    const issues: ValidationIssue[] = [];
    const fields = validateFields(input, issues);
    if (fields) {
      const started = await listStartedSlots(tx, jobId);
      issues.push(...startedScheduleIssues(started, current.schedule, fields.schedule));
    }
    if (!fields || issues.length > 0) throw new ValidationError(issues);

    const [job] = await tx
      .update(jobs)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    return job as Job;
  });
}

/** Every start of the schedule runs once per device. */
export function plannedRunCount(job: Pick<Job, 'schedule' | 'devices'>): number {
  return expandSchedule(job.schedule).length * job.devices.length;
}

export async function getJob(db: Database, jobId: string): Promise<Job> {
  const job = isUuid(jobId) ? await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) }) : null;
  if (!job) throw new NotFoundError('Job', jobId);
  return job;
}

/**
 * Hands out the next run number of a job (`{{run_nr}}`). A single UPDATE … RETURNING keeps it
 * unique even when all bots of a wave ask at the same moment.
 */
export async function allocateRunNumber(db: Database, jobId: string): Promise<number> {
  const [row] = await db
    .update(jobs)
    .set({ runCounter: sql`${jobs.runCounter} + 1` })
    .where(eq(jobs.id, jobId))
    .returning({ runNr: jobs.runCounter });
  if (!row) throw new NotFoundError('Job', jobId);
  return row.runNr;
}
