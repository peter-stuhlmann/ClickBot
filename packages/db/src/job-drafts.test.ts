import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign, insertCustomer } from '../test/db';
import { NotFoundError, ValidationError } from './errors';
import { saveJobDraft, type JobDraftInput } from './job-drafts';
import { createJob, getJob, updateJob } from './jobs';
import { listJobOverview } from './overview';
import { jobs } from './schema';

const now = new Date('2026-11-02T10:00:00Z');

const flow = {
  version: 1,
  steps: [
    { id: 'open', type: 'open', url: 'https://beispiel.de' },
    { id: 'kurs', type: 'click', target: { by: 'text', text: 'Kurse' } },
  ],
};

function input(campaignId: string, overrides: Partial<JobDraftInput> = {}): JobDraftInput {
  return {
    campaignId,
    name: 'Kurse',
    startUrl: 'https://beispiel.de',
    flow,
    schedule: { type: 'interval', everyMinutes: 60, maxRuns: 3, startAt: '2026-11-02T11:00:00Z' },
    devices: ['desktop', 'iphone'],
    wizardState: { version: 1, step: 0 },
    now,
    ...overrides,
  };
}

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  );

describe('saveJobDraft', () => {
  it('stores a new draft with the form of the wizard, in the project of the campaign', async () => {
    const { campaignId, customerId } = await insertCampaign();
    const job = await saveJobDraft(db, null, input(campaignId));

    expect(job).toMatchObject({
      status: 'draft',
      campaignId,
      customerId,
      name: 'Kurse',
      startUrl: 'https://beispiel.de',
      devices: ['desktop', 'iphone'],
      wizardState: { version: 1, step: 0 },
    });
    expect(job.flow.steps.map((step) => step.id)).toEqual(['open', 'kurs']);
  });

  it('fills in what is not valid yet, because a draft is half done', async () => {
    const { campaignId } = await insertCampaign();
    const job = await saveJobDraft(
      db,
      null,
      input(campaignId, { name: ' ', flow: { version: 1, steps: [] }, schedule: {}, devices: [] }),
    );

    expect(job).toMatchObject({
      name: 'Neuer Test',
      devices: ['desktop'],
      deviceBrowsers: { desktop: ['chromium'] },
      schedule: { type: 'interval', everyMinutes: 60, maxRuns: 1, startAt: now.toISOString() },
    });
    // Only the start URL, so a test run of it would at least open the page.
    expect(job.flow.steps).toMatchObject([{ type: 'open', url: 'https://beispiel.de' }]);
  });

  it('needs a valid start URL and an existing campaign, the least a test is about', async () => {
    const { campaignId } = await insertCampaign();
    const badUrl = await errorOf(
      saveJobDraft(db, null, input(campaignId, { startUrl: 'beispiel' })),
    );
    expect(badUrl).toBeInstanceOf(ValidationError);
    expect((badUrl as ValidationError).issues.map((issue) => issue.path)).toEqual(['startUrl']);

    const noCampaign = await errorOf(
      saveJobDraft(db, null, input('00000000-0000-0000-0000-000000000000')),
    );
    expect((noCampaign as ValidationError).issues.map((issue) => issue.path)).toEqual([
      'campaignId',
    ]);
    expect(await db.select().from(jobs)).toHaveLength(0);
  });

  it('updates the draft and keeps the stored value of a field that is not valid right now', async () => {
    const { campaignId } = await insertCampaign();
    const first = await saveJobDraft(db, null, input(campaignId));
    const second = await saveJobDraft(
      db,
      first.id,
      input(campaignId, {
        name: 'Kurse buchen',
        // A step being edited, its target still empty.
        flow: { version: 1, steps: [{ id: 'open', type: 'click', target: { by: 'text' } }] },
        startUrl: 'https://beispiel.de/kurse',
        wizardState: { version: 1, step: 1 },
      }),
    );

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({
      name: 'Kurse buchen',
      startUrl: 'https://beispiel.de/kurse',
      wizardState: { version: 1, step: 1 },
    });
    expect(second.flow).toEqual(first.flow);
    expect(await db.select().from(jobs)).toHaveLength(1);
  });

  it('keeps the draft in its project, whatever campaign comes from the browser', async () => {
    const { campaignId } = await insertCampaign();
    const other = await insertCampaign('Andere', await insertCustomer('Andere GmbH', 'andere'));
    const draft = await saveJobDraft(db, null, input(campaignId));
    const saved = await saveJobDraft(db, draft.id, input(other.campaignId));
    expect(saved.campaignId).toBe(campaignId);
  });

  it('never overwrites a job that is no wizard draft (any more)', async () => {
    const { campaignId } = await insertCampaign();
    const job = await createJob(db, { ...input(campaignId), status: 'active' });
    expect(await errorOf(saveJobDraft(db, job.id, input(campaignId)))).toBeInstanceOf(
      NotFoundError,
    );
    expect(await errorOf(saveJobDraft(db, 'job-1', input(campaignId)))).toBeInstanceOf(
      NotFoundError,
    );
    expect((await getJob(db, job.id)).name).toBe('Kurse');
  });

  it('refuses a form that is too big to keep', async () => {
    const { campaignId } = await insertCampaign();
    const error = await errorOf(
      saveJobDraft(db, null, input(campaignId, { wizardState: { text: 'x'.repeat(300_000) } })),
    );
    expect((error as ValidationError).issues).toEqual([
      { path: 'wizardState', message: 'Der Entwurf ist zu groß.' },
    ]);
  });
});

describe('a wizard draft becoming a test', () => {
  it('is activated by updateJob, which drops the form of the wizard', async () => {
    const { campaignId } = await insertCampaign();
    const draft = await saveJobDraft(db, null, input(campaignId));
    const job = await updateJob(db, draft.id, {
      ...input(campaignId),
      devices: ['desktop'],
      activate: true,
    });
    expect(job).toMatchObject({ status: 'active', wizardState: null });
  });

  it('loses its form when saved in the editor, so the editor version counts', async () => {
    const { campaignId } = await insertCampaign();
    const draft = await saveJobDraft(db, null, input(campaignId));
    const job = await updateJob(db, draft.id, { ...input(campaignId), devices: ['desktop'] });
    expect(job).toMatchObject({ status: 'draft', wizardState: null });
  });

  it('is marked in the job list, so its name leads back to the wizard', async () => {
    const { campaignId } = await insertCampaign();
    const draft = await saveJobDraft(db, null, input(campaignId));
    await createJob(db, { ...input(campaignId), name: 'Fertig', status: 'active' });

    const rows = await listJobOverview(db);
    expect(rows.map((row) => [row.name, row.inWizard])).toEqual([
      ['Kurse', true],
      ['Fertig', false],
    ]);
    await db.update(jobs).set({ wizardState: null }).where(eq(jobs.id, draft.id));
    expect((await listJobOverview(db))[0]?.inWizard).toBe(false);
  });
});
