import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError, ValidationError } from './errors';
import { isUuid } from './ids';
import { campaignProject, validateFields, type Device, type Job, type JobFields } from './jobs';
import { jobs } from './schema';

export type JobDraftInput = {
  /** The campaign of a new draft; a saved draft only moves within its project. */
  campaignId: string;
  name: string;
  startUrl: string;
  /** Untrusted input, like everything below; what is not valid yet keeps the stored value. */
  flow: unknown;
  schedule: unknown;
  devices?: Device[];
  deviceBrowsers?: unknown;
  analyticsMarking?: unknown;
  blockAds?: unknown;
  recordVideo?: unknown;
  /** The wizard's form as it is, stored as given. The caller removes passwords first. */
  wizardState: unknown;
  /** The default start of a schedule that is not valid yet. */
  now: Date;
};

/** Below the CHECK on jobs.wizard_state: Postgres writes jsonb with a few more spaces. */
const MAX_STATE_BYTES = 200_000;

export const DRAFT_NAME = 'Neuer Test';

/** Fields that are checked together; one that is not valid keeps the value it had. */
const FIELD_GROUPS = [
  ['name'],
  ['startUrl'],
  ['flow'],
  ['schedule'],
  ['devices', 'deviceBrowsers'],
  ['analyticsMarking'],
  ['blockAds'],
  ['recordVideo'],
] as const;

/** Takes every field (group) of the input that is valid on its own; keeps `base` for the rest. */
function mergeValid(input: JobDraftInput, base: JobFields): JobFields {
  let fields = base;
  for (const group of FIELD_GROUPS) {
    const candidate = { ...fields, ...Object.fromEntries(group.map((key) => [key, input[key]])) };
    fields = validateFields(candidate, []) ?? fields;
  }
  return fields;
}

/** A new draft: only its start URL must be valid, everything else has a default. */
function defaults(startUrl: string, now: Date): JobFields | null {
  return validateFields(
    {
      name: DRAFT_NAME,
      startUrl,
      flow: { version: 1, steps: [{ id: 'open', type: 'open', url: startUrl }] },
      schedule: { type: 'interval', everyMinutes: 60, maxRuns: 1, startAt: now.toISOString() },
    },
    [],
  );
}

/**
 * Saves the form of the "Neuer Job" wizard as a draft job, right as it is being filled in, so a
 * reload loses nothing and a "Testlauf" has a job to run. A draft is never planned. A field that
 * is not valid yet (a step being edited) keeps its stored value; the form itself goes into
 * `wizardState` unchanged. "Test anlegen" checks everything (updateJob with `activate`).
 */
export async function saveJobDraft(
  db: Database,
  jobId: string | null,
  input: JobDraftInput,
): Promise<Job> {
  const bytes = new TextEncoder().encode(JSON.stringify(input.wizardState ?? null)).length;
  if (bytes > MAX_STATE_BYTES) {
    throw new ValidationError([{ path: 'wizardState', message: 'Der Entwurf ist zu groß.' }]);
  }

  if (jobId === null) {
    const project = await campaignProject(db, input.campaignId);
    const base = defaults(input.startUrl, input.now);
    const issues = [
      ...('issue' in project ? [project.issue] : []),
      ...(base
        ? []
        : [{ path: 'startUrl', message: 'Die Adresse muss mit http:// oder https:// beginnen.' }]),
    ];
    if ('issue' in project || !base) throw new ValidationError(issues);
    const [job] = await db
      .insert(jobs)
      .values({
        campaignId: input.campaignId,
        customerId: project.customerId,
        ...mergeValid(input, base),
        status: 'draft',
        wizardState: input.wizardState,
      })
      .returning();
    return job as Job;
  }

  if (!isUuid(jobId)) throw new NotFoundError('Entwurf', jobId);
  return db.transaction(async (tx) => {
    // Only a draft the wizard still owns: a created job is never overwritten from a stale tab.
    const [current] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.status, 'draft'), isNotNull(jobs.wizardState)))
      .for('update');
    if (!current) throw new NotFoundError('Entwurf', jobId);

    const target = await campaignProject(tx, input.campaignId);
    const campaignId =
      !('issue' in target) && target.customerId === current.customerId
        ? input.campaignId
        : current.campaignId;
    const [job] = await tx
      .update(jobs)
      .set({
        ...mergeValid(input, current),
        campaignId,
        wizardState: input.wizardState,
        updatedAt: sql`now()`,
      })
      .where(eq(jobs.id, jobId))
      .returning();
    return job as Job;
  });
}
