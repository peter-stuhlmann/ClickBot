import { DEFAULT_TIMEZONE, localToUtc, type Schedule } from '@click-bot/shared';
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError, ValidationError } from './errors';
import { plannedRunCount, type Job } from './jobs';
import { customers, jobs, runs } from './schema';

type JobStatus = Job['status'];
type RunStatus = (typeof runs.$inferSelect)['status'];

/** Runs that reached a verdict. Cancelled runs say nothing about the website. */
export const FINISHED = ['passed', 'warning', 'failed'] as const;
/** A warning means the site worked but needed help (e.g. AI fallback): still a success. */
const SUCCESSFUL = ['passed', 'warning'] as const;

const DAY_MS = 86_400_000;

export type JobOverviewRow = {
  id: string;
  name: string;
  startUrl: string;
  status: JobStatus;
  customerName: string;
  schedule: Schedule;
  runsDone: number;
  runsPlanned: number;
  lastRun: { id: string; status: RunStatus; finishedAt: Date } | null;
  /** Share of successful finished runs including test runs, 0–1; null without any. */
  successRate: number | null;
};

export async function listJobOverview(db: Database): Promise<JobOverviewRow[]> {
  const rows = await db
    .select({
      job: jobs,
      customerName: customers.name,
      // Progress of the schedule: test runs (no slot) do not count, they are extra.
      runsDone:
        sql<number>`count(${runs.id}) filter (where ${and(inArray(runs.status, FINISHED), isNotNull(runs.slotIndex))})`.mapWith(
          Number,
        ),
      finished:
        sql<number>`count(${runs.id}) filter (where ${inArray(runs.status, FINISHED)})`.mapWith(
          Number,
        ),
      successful:
        sql<number>`count(${runs.id}) filter (where ${inArray(runs.status, SUCCESSFUL)})`.mapWith(
          Number,
        ),
    })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .leftJoin(runs, eq(runs.jobId, jobs.id))
    .groupBy(jobs.id, customers.name)
    .orderBy(asc(jobs.createdAt), asc(jobs.id));

  const lastRuns = await db
    .selectDistinctOn([runs.jobId], {
      jobId: runs.jobId,
      id: runs.id,
      status: runs.status,
      finishedAt: runs.finishedAt,
    })
    .from(runs)
    .where(and(inArray(runs.status, FINISHED), isNotNull(runs.finishedAt)))
    .orderBy(runs.jobId, desc(runs.finishedAt));
  const lastRunByJob = new Map(lastRuns.map((run) => [run.jobId, run]));

  return rows.map(({ job, customerName, runsDone, finished, successful }) => {
    const lastRun = lastRunByJob.get(job.id);
    return {
      id: job.id,
      name: job.name,
      startUrl: job.startUrl,
      status: job.status,
      customerName,
      schedule: job.schedule,
      runsDone,
      runsPlanned: plannedRunCount(job),
      lastRun: lastRun?.finishedAt
        ? { id: lastRun.id, status: lastRun.status, finishedAt: lastRun.finishedAt }
        : null,
      successRate: finished > 0 ? successful / finished : null,
    };
  });
}

export type DashboardStats = {
  activeJobs: number;
  finishedJobs: number;
  runsToday: number;
  runsYesterday: number;
  successRate7d: { successful: number; finished: number };
  failures24h: { count: number; jobNames: string[] };
};

function localDate(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

/** Midnight of a local date; in the rare zones that skip midnight, 01:00. */
function startOfLocalDay(date: string, timeZone: string): Date {
  return (localToUtc(date, '00:00', timeZone) ?? localToUtc(date, '01:00', timeZone)) as Date;
}

function previousDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** Figures for the jobs overview. "Today" and "yesterday" follow the local calendar. */
export async function getDashboardStats(
  db: Database,
  now: Date,
  timeZone = DEFAULT_TIMEZONE,
): Promise<DashboardStats> {
  const today = localDate(now, timeZone);
  const todayStart = startOfLocalDay(today, timeZone);
  const yesterdayStart = startOfLocalDay(previousDate(today), timeZone);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);

  const jobCounts = await db
    .select({ status: jobs.status, count: sql<number>`count(*)`.mapWith(Number) })
    .from(jobs)
    .groupBy(jobs.status);
  const countOf = (status: JobStatus) => jobCounts.find((row) => row.status === status)?.count ?? 0;

  const at = runs.finishedAt;
  const [runCounts] = await db
    .select({
      today: sql<number>`count(*) filter (where ${at} >= ${todayStart})`.mapWith(Number),
      yesterday:
        sql<number>`count(*) filter (where ${at} >= ${yesterdayStart} and ${at} < ${todayStart})`.mapWith(
          Number,
        ),
      finished7d: sql<number>`count(*) filter (where ${at} >= ${weekAgo})`.mapWith(Number),
      successful7d:
        sql<number>`count(*) filter (where ${at} >= ${weekAgo} and ${inArray(runs.status, SUCCESSFUL)})`.mapWith(
          Number,
        ),
    })
    .from(runs)
    .where(and(inArray(runs.status, FINISHED), isNotNull(at)));

  const failures = await db
    .select({ jobName: jobs.name })
    .from(runs)
    .innerJoin(jobs, eq(jobs.id, runs.jobId))
    .where(and(eq(runs.status, 'failed'), gte(at, dayAgo)))
    .orderBy(asc(jobs.name));

  return {
    activeJobs: countOf('active'),
    finishedJobs: countOf('finished'),
    runsToday: runCounts?.today ?? 0,
    runsYesterday: runCounts?.yesterday ?? 0,
    successRate7d: {
      successful: runCounts?.successful7d ?? 0,
      finished: runCounts?.finished7d ?? 0,
    },
    failures24h: {
      count: failures.length,
      jobNames: [...new Set(failures.map((failure) => failure.jobName))],
    },
  };
}

/**
 * Pauses (`active = false`) or resumes a job. Only active and paused jobs can be toggled; the
 * status check is part of the UPDATE, so a concurrent change cannot slip through.
 */
export async function setJobActive(db: Database, jobId: string, active: boolean): Promise<Job> {
  const [job] = await db
    .update(jobs)
    .set({ status: active ? 'active' : 'paused', updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ['active', 'paused'])))
    .returning();
  if (job) return job;

  const exists = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    columns: { id: true },
  });
  if (!exists) throw new NotFoundError('Job', jobId);
  throw new ValidationError([
    {
      path: 'status',
      message: 'Entwürfe und beendete Jobs lassen sich nicht pausieren oder fortsetzen.',
    },
  ]);
}
