import { and, asc, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError, ValidationError, type ValidationIssue } from './errors';
import { isUuid } from './ids';
import { FINISHED } from './overview';
import { campaigns, customers, jobs, runs } from './schema';

export type Campaign = typeof campaigns.$inferSelect;
export type CampaignOption = { id: string; name: string };

/** The campaign every new project starts with, and where the jobs from before campaigns went. */
export const DEFAULT_CAMPAIGN = 'Allgemein';

const SUCCESSFUL = ['passed', 'warning'] as const;
const DAY_MS = 86_400_000;
const MAX_NAME = 120;
const MAX_DESCRIPTION = 2_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NO_ID = '00000000-0000-0000-0000-000000000000';

export type NewCampaignInput = {
  customerId: string;
  name: string;
  /** Calendar dates (YYYY-MM-DD); empty or omitted for none. */
  startsOn?: string | null;
  endsOn?: string | null;
  description?: string | null;
};

function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const blankToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

type CampaignFields = Pick<Campaign, 'name' | 'startsOn' | 'endsOn' | 'description'>;

/**
 * Checks a campaign of `customerId` and returns the values to store, or throws ValidationError
 * with every problem. `except` is the campaign itself when it is changed.
 */
async function checkedFields(
  db: Database,
  customerId: string,
  input: Omit<NewCampaignInput, 'customerId'>,
  except?: string,
): Promise<CampaignFields> {
  const issues: ValidationIssue[] = [];
  const name = input.name.trim();
  const startsOn = blankToNull(input.startsOn);
  const endsOn = blankToNull(input.endsOn);
  const description = blankToNull(input.description);

  const project =
    isUuid(customerId) &&
    (await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
      columns: { id: true },
    }));
  if (!project) issues.push({ path: 'customerId', message: 'Projekt nicht gefunden.' });

  if (!name) issues.push({ path: 'name', message: 'Name fehlt.' });
  else if (name.length > MAX_NAME) {
    issues.push({ path: 'name', message: `Name ist zu lang (höchstens ${MAX_NAME} Zeichen).` });
  } else if (project) {
    const [twin] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.customerId, customerId),
          sql`lower(${campaigns.name}) = lower(${name})`,
          except ? ne(campaigns.id, except) : undefined,
        ),
      )
      .limit(1);
    if (twin) {
      issues.push({ path: 'name', message: 'Diese Kampagne gibt es in diesem Projekt schon.' });
    }
  }
  const validStart = startsOn !== null && isDate(startsOn);
  const validEnd = endsOn !== null && isDate(endsOn);
  if (startsOn && !validStart) issues.push({ path: 'startsOn', message: 'Kein gültiges Datum.' });
  if (endsOn && !validEnd) issues.push({ path: 'endsOn', message: 'Kein gültiges Datum.' });
  if (validStart && validEnd && (endsOn as string) < (startsOn as string)) {
    issues.push({ path: 'endsOn', message: 'Das Ende liegt vor dem Start.' });
  }
  if (description && description.length > MAX_DESCRIPTION) {
    issues.push({ path: 'description', message: `Höchstens ${MAX_DESCRIPTION} Zeichen.` });
  }
  if (issues.length > 0) throw new ValidationError(issues);
  return { name, startsOn, endsOn, description };
}

/** Creates a campaign in a project. Names are unique per project, ignoring case. */
export async function createCampaign(db: Database, input: NewCampaignInput): Promise<Campaign> {
  const fields = await checkedFields(db, input.customerId, input);
  const [campaign] = await db
    .insert(campaigns)
    .values({ customerId: input.customerId, ...fields })
    .returning();
  return campaign as Campaign;
}

/** Changes name, period and note; the campaign stays in its project. */
export async function updateCampaign(
  db: Database,
  id: string,
  input: Omit<NewCampaignInput, 'customerId'>,
): Promise<Campaign> {
  const current = await getCampaign(db, id);
  if (!current) throw new NotFoundError('Kampagne', id);
  const fields = await checkedFields(db, current.customerId, input, id);
  const [campaign] = await db.update(campaigns).set(fields).where(eq(campaigns.id, id)).returning();
  return campaign as Campaign;
}

/** Deletes a campaign that has no jobs (any more): every job needs its campaign. */
export async function deleteCampaign(db: Database, id: string): Promise<void> {
  if (!(await getCampaign(db, id))) throw new NotFoundError('Kampagne', id);
  await db.transaction(async (tx) => {
    await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, id)).for('update');
    const [{ count } = { count: 0 }] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(jobs)
      .where(eq(jobs.campaignId, id));
    if (count > 0) {
      const message =
        count === 1
          ? 'Die Kampagne hat noch 1 Job. Verschiebe ihn im Editor in eine andere Kampagne oder lösche ihn.'
          : `Die Kampagne hat noch ${count} Jobs. Verschiebe sie im Editor in eine andere Kampagne oder lösche sie.`;
      throw new ValidationError([{ path: 'form', message }]);
    }
    await tx.delete(campaigns).where(eq(campaigns.id, id));
  });
}

export async function getCampaign(db: Database, campaignId: string): Promise<Campaign | null> {
  if (!isUuid(campaignId)) return null;
  return (await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) })) ?? null;
}

/** The campaigns of a project by name, e.g. for the campaign choice in the job wizard. */
export async function listCampaigns(db: Database, customerId: string): Promise<CampaignOption[]> {
  if (!isUuid(customerId)) return [];
  return db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.customerId, customerId))
    .orderBy(asc(campaigns.name));
}

type RunStatus = (typeof runs.$inferSelect)['status'];

export type CampaignOverviewRow = {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  jobs: { total: number; active: number; finished: number };
  /** Hosts of the start URLs of the campaign's jobs, sorted. */
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

/** "Kampagnen": one row per campaign of a project, by name. */
export async function listCampaignOverview(
  db: Database,
  customerId: string,
  now: Date,
): Promise<CampaignOverviewRow[]> {
  if (!isUuid(customerId)) return [];
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const own = eq(jobs.customerId, customerId);
  const [campaignRows, jobRows, runCounts, lastRuns] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        startsOn: campaigns.startsOn,
        endsOn: campaigns.endsOn,
      })
      .from(campaigns)
      .where(eq(campaigns.customerId, customerId))
      .orderBy(asc(campaigns.name)),
    db
      .select({ campaignId: jobs.campaignId, status: jobs.status, startUrl: jobs.startUrl })
      .from(jobs)
      .where(own),
    db
      .select({
        campaignId: jobs.campaignId,
        finished: sql<number>`count(*)`.mapWith(Number),
        successful:
          sql<number>`count(*) filter (where ${inArray(runs.status, SUCCESSFUL)})`.mapWith(Number),
      })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(and(own, inArray(runs.status, FINISHED), gte(runs.finishedAt, since)))
      .groupBy(jobs.campaignId),
    db
      .selectDistinctOn([jobs.campaignId], {
        campaignId: jobs.campaignId,
        id: runs.id,
        status: runs.status,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(and(own, inArray(runs.status, FINISHED), isNotNull(runs.finishedAt)))
      .orderBy(jobs.campaignId, desc(runs.finishedAt)),
  ]);

  return campaignRows.map((campaign) => {
    const mine = jobRows.filter((job) => job.campaignId === campaign.id);
    const counts = runCounts.find((row) => row.campaignId === campaign.id);
    const last = lastRuns.find((row) => row.campaignId === campaign.id);
    const hosts = new Set(mine.map((job) => hostOf(job.startUrl)).filter((host) => host !== null));
    return {
      ...campaign,
      jobs: {
        total: mine.length,
        active: mine.filter((job) => job.status === 'active').length,
        finished: mine.filter((job) => job.status === 'finished').length,
      },
      hosts: [...hosts].sort(),
      runs30d: { finished: counts?.finished ?? 0, successful: counts?.successful ?? 0 },
      lastRun: last?.finishedAt
        ? { id: last.id, status: last.status, finishedAt: last.finishedAt }
        : null,
    };
  });
}

export type CampaignStats = {
  campaigns: number;
  jobs: { total: number; active: number; finished: number };
  runs30d: number;
  runsPrevious30d: number;
  successRate30d: { successful: number; finished: number };
};

/** Figures above the campaign table, for one project. */
export async function getCampaignStats(
  db: Database,
  customerId: string,
  now: Date,
): Promise<CampaignStats> {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const before = new Date(now.getTime() - 60 * DAY_MS);
  const at = runs.finishedAt;
  const id = isUuid(customerId) ? customerId : NO_ID;

  const [[campaignCount], [jobCounts], [runCounts]] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(campaigns)
      .where(eq(campaigns.customerId, id)),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${jobs.status} = 'active')`.mapWith(Number),
        finished: sql<number>`count(*) filter (where ${jobs.status} = 'finished')`.mapWith(Number),
      })
      .from(jobs)
      .where(eq(jobs.customerId, id)),
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
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .where(
        and(eq(jobs.customerId, id), inArray(runs.status, FINISHED), gte(at, before), lt(at, now)),
      ),
  ]);

  return {
    campaigns: campaignCount?.total ?? 0,
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
