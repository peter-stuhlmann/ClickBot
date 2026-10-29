import { DEFAULT_TIMEZONE } from '@click-bot/shared';
import { and, asc, desc, eq, gte, inArray, isNotNull, like, lt, or, sql } from 'drizzle-orm';
import type { Database } from './client';
import { ValidationError } from './errors';
import { FINISHED, localDate, startOfLocalDay } from './overview';
import { customers, jobs, runs } from './schema';

export type Customer = typeof customers.$inferSelect;
export type CustomerOption = { id: string; name: string };

const SUCCESSFUL = ['passed', 'warning'] as const;
const DAY_MS = 86_400_000;
const MAX_NAME = 120;

/** All customers by name, e.g. for the customer choice in the job wizard. */
export async function listCustomers(db: Database): Promise<CustomerOption[]> {
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .orderBy(asc(customers.name));
}

/** "Müller Shop" → "mueller-shop": the short name used in URLs and file names. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'projekt';
}

/** The slug of `name`, numbered (-2, -3, …) if it is taken. */
async function freeSlug(db: Database, name: string): Promise<string> {
  const base = slugify(name);
  const taken = await db
    .select({ slug: customers.slug })
    .from(customers)
    .where(or(eq(customers.slug, base), like(customers.slug, `${base}-%`)));
  const slugs = new Set(taken.map((row) => row.slug));
  if (!slugs.has(base)) return base;
  let number = 2;
  while (slugs.has(`${base}-${number}`)) number += 1;
  return `${base}-${number}`;
}

/** Creates a customer; the slug comes from the name. Names are unique, ignoring case. */
export async function createCustomer(db: Database, input: { name: string }): Promise<Customer> {
  const name = input.name.trim();
  const fail = (message: string) => new ValidationError([{ path: 'name', message }]);
  if (!name) throw fail('Name fehlt.');
  if (name.length > MAX_NAME) throw fail(`Name ist zu lang (höchstens ${MAX_NAME} Zeichen).`);

  const [twin] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`lower(${customers.name}) = lower(${name})`)
    .limit(1);
  if (twin) throw fail('Dieses Projekt gibt es schon.');

  const [customer] = await db
    .insert(customers)
    .values({ name, slug: await freeSlug(db, name) })
    .returning();
  return customer as Customer;
}

type RunStatus = (typeof runs.$inferSelect)['status'];

export type CustomerOverviewRow = {
  id: string;
  name: string;
  jobs: { total: number; active: number; finished: number };
  /** Hosts of the start URLs of the customer's jobs, sorted. */
  hosts: string[];
  /** Finished runs (incl. test runs) of the last 30 days. */
  runs30d: { finished: number; successful: number };
  lastRun: { id: string; status: RunStatus; finishedAt: Date } | null;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Screen 10 "Projekte": one row per customer, by name. */
export async function listCustomerOverview(
  db: Database,
  now: Date,
): Promise<CustomerOverviewRow[]> {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [customerRows, jobRows, runCounts, lastRuns] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(asc(customers.name)),
    db
      .select({ customerId: jobs.customerId, status: jobs.status, startUrl: jobs.startUrl })
      .from(jobs),
    db
      .select({
        customerId: jobs.customerId,
        finished: sql<number>`count(*)`.mapWith(Number),
        successful:
          sql<number>`count(*) filter (where ${inArray(runs.status, SUCCESSFUL)})`.mapWith(Number),
      })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(and(inArray(runs.status, FINISHED), gte(runs.finishedAt, since)))
      .groupBy(jobs.customerId),
    db
      .selectDistinctOn([jobs.customerId], {
        customerId: jobs.customerId,
        id: runs.id,
        status: runs.status,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(and(inArray(runs.status, FINISHED), isNotNull(runs.finishedAt)))
      .orderBy(jobs.customerId, desc(runs.finishedAt)),
  ]);

  return customerRows.map((customer) => {
    const own = jobRows.filter((job) => job.customerId === customer.id);
    const counts = runCounts.find((row) => row.customerId === customer.id);
    const last = lastRuns.find((row) => row.customerId === customer.id);
    const hosts = new Set(own.map((job) => hostOf(job.startUrl)).filter((host) => host !== null));
    return {
      id: customer.id,
      name: customer.name,
      jobs: {
        total: own.length,
        active: own.filter((job) => job.status === 'active').length,
        finished: own.filter((job) => job.status === 'finished').length,
      },
      hosts: [...hosts].sort(),
      runs30d: { finished: counts?.finished ?? 0, successful: counts?.successful ?? 0 },
      lastRun: last?.finishedAt
        ? { id: last.id, status: last.status, finishedAt: last.finishedAt }
        : null,
    };
  });
}

export type CustomerStats = {
  customers: number;
  /** Created since the first of this month (local calendar). */
  newThisMonth: number;
  jobs: { total: number; active: number; finished: number };
  runs30d: number;
  runsPrevious30d: number;
  successRate30d: { successful: number; finished: number };
};

/** Figures above the customer table. */
export async function getCustomerStats(
  db: Database,
  now: Date,
  timeZone = DEFAULT_TIMEZONE,
): Promise<CustomerStats> {
  const monthStart = startOfLocalDay(`${localDate(now, timeZone).slice(0, 8)}01`, timeZone);
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const before = new Date(now.getTime() - 60 * DAY_MS);
  const at = runs.finishedAt;

  const [[customerCounts], [jobCounts], [runCounts]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        fresh: sql<number>`count(*) filter (where ${customers.createdAt} >= ${monthStart})`.mapWith(
          Number,
        ),
      })
      .from(customers),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${jobs.status} = 'active')`.mapWith(Number),
        finished: sql<number>`count(*) filter (where ${jobs.status} = 'finished')`.mapWith(Number),
      })
      .from(jobs),
    db
      .select({
        recent: sql<number>`count(*) filter (where ${at} >= ${since})`.mapWith(Number),
        previous: sql<number>`count(*) filter (where ${at} < ${since})`.mapWith(Number),
        successful:
          sql<number>`count(*) filter (where ${at} >= ${since} and ${inArray(runs.status, SUCCESSFUL)})`.mapWith(
            Number,
          ),
      })
      .from(runs)
      .where(and(inArray(runs.status, FINISHED), gte(at, before), lt(at, now))),
  ]);

  return {
    customers: customerCounts?.total ?? 0,
    newThisMonth: customerCounts?.fresh ?? 0,
    jobs: {
      total: jobCounts?.total ?? 0,
      active: jobCounts?.active ?? 0,
      finished: jobCounts?.finished ?? 0,
    },
    runs30d: runCounts?.recent ?? 0,
    runsPrevious30d: runCounts?.previous ?? 0,
    successRate30d: { successful: runCounts?.successful ?? 0, finished: runCounts?.recent ?? 0 },
  };
}
