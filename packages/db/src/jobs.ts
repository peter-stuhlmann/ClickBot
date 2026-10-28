import { flowSchema, scheduleSchema } from '@click-bot/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './client';
import { NotFoundError, ValidationError, issuesFromZod, type ValidationIssue } from './errors';
import { device, jobs } from './schema';

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
};

const startUrlSchema = z.string().refine((value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Start-URL muss mit http:// oder https:// beginnen.');

const devicesSchema = z.array(z.enum(device.enumValues)).min(1, 'Mindestens ein Gerät wählen.');

/** Validates everything first and reports all problems at once; writes nothing if one fails. */
export async function createJob(db: Database, input: NewJobInput): Promise<Job> {
  const issues: ValidationIssue[] = [];

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

  if (!startUrl.success || !devices.success || !flow.success || !schedule.success || !name) {
    throw new ValidationError(issues);
  }

  const [job] = await db
    .insert(jobs)
    .values({
      customerId: input.customerId,
      name,
      startUrl: startUrl.data,
      flow: flow.data,
      schedule: schedule.data,
      devices: devices.data,
    })
    .returning();
  return job as Job;
}

export async function getJob(db: Database, jobId: string): Promise<Job> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
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
