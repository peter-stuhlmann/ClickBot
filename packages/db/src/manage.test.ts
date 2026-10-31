import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
import {
  campaignDeletePhrase,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
} from './campaigns';
import { createCustomer, deleteCustomer, getCustomer, updateCustomer } from './customers';
import { NotFoundError, ValidationError } from './errors';
import { createJob, deleteJob, getJob, updateJob } from './jobs';
import { createSecret } from './secrets';
import { createCipher } from './crypto';
import { campaigns, customers, jobs, runs, secrets } from './schema';

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: '/' }] };
const schedule = {
  type: 'interval',
  everyMinutes: 60,
  maxRuns: 5,
  startAt: '2026-11-05T10:00:00Z',
};
const UNKNOWN = '00000000-0000-0000-0000-000000000000';

const jobIn = (campaignId: string, name = 'Kontakt') =>
  createJob(db, { campaignId, name, startUrl: 'https://beispiel.de', flow, schedule });

const issuesOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
};

describe('updateCustomer', () => {
  it('renames a project and keeps its short name for URLs', async () => {
    const project = await createCustomer(db, { name: 'Müller Shop' });
    const renamed = await updateCustomer(db, project.id, { name: '  Müller Online ' });
    expect(renamed).toMatchObject({ name: 'Müller Online', slug: 'mueller-shop' });
    expect(await getCustomer(db, project.id)).toMatchObject({ name: 'Müller Online' });
  });

  it('refuses the name of another project, but not its own in another case', async () => {
    await createCustomer(db, { name: 'Nordlicht Hotel' });
    const project = await createCustomer(db, { name: 'Müller Shop' });
    expect(await issuesOf(updateCustomer(db, project.id, { name: 'nordlicht hotel' }))).toEqual([
      { path: 'name', message: 'Dieses Projekt gibt es schon.' },
    ]);
    expect((await updateCustomer(db, project.id, { name: 'MÜLLER SHOP' })).name).toBe(
      'MÜLLER SHOP',
    );
  });

  it('says when the project does not exist', async () => {
    await expect(updateCustomer(db, UNKNOWN, { name: 'X' })).rejects.toThrow(NotFoundError);
    expect(await getCustomer(db, 'kaputt')).toBeNull();
  });
});

describe('deleteCustomer', () => {
  it('deletes a project without jobs, with its empty campaigns and its secrets', async () => {
    const project = await createCustomer(db, { name: 'Weg damit' });
    await createCampaign(db, { customerId: project.id, name: 'Sommer' });
    await createSecret(db, createCipher(Buffer.alloc(32, 1)), {
      customerId: project.id,
      name: 'login',
      value: 'geheim',
      allowedDomains: ['beispiel.de'],
    });

    await deleteCustomer(db, project.id);
    expect(await getCustomer(db, project.id)).toBeNull();
    expect(await db.select().from(campaigns).where(eq(campaigns.customerId, project.id))).toEqual(
      [],
    );
    expect(await db.select().from(secrets).where(eq(secrets.customerId, project.id))).toEqual([]);
  });

  it('keeps a project that still has jobs, and says why', async () => {
    const { customerId, campaignId } = await insertCampaign();
    await jobIn(campaignId);
    await jobIn(campaignId, 'Login');
    expect(await issuesOf(deleteCustomer(db, customerId))).toEqual([
      { path: 'form', message: 'Das Projekt hat noch 2 Tests. Lösche sie zuerst.' },
    ]);
    expect(await db.select().from(customers).where(eq(customers.id, customerId))).toHaveLength(1);
  });

  it('says when the project does not exist', async () => {
    await expect(deleteCustomer(db, UNKNOWN)).rejects.toThrow(NotFoundError);
  });
});

describe('updateCampaign', () => {
  it('changes name, period and note', async () => {
    const { campaignId } = await insertCampaign('Sommer');
    const changed = await updateCampaign(db, campaignId, {
      name: 'Sommerschluss',
      startsOn: '2026-08-01',
      endsOn: '',
      description: 'Restposten',
    });
    expect(changed).toMatchObject({
      name: 'Sommerschluss',
      startsOn: '2026-08-01',
      endsOn: null,
      description: 'Restposten',
    });
  });

  it('checks like creating: unique name in the project, period in order', async () => {
    const { customerId, campaignId } = await insertCampaign('Sommer');
    await createCampaign(db, { customerId, name: 'Winter' });
    expect(
      await issuesOf(
        updateCampaign(db, campaignId, {
          name: 'winter',
          startsOn: '2026-08-31',
          endsOn: '2026-08-01',
        }),
      ),
    ).toEqual([
      { path: 'name', message: 'Diese Kampagne gibt es in diesem Projekt schon.' },
      { path: 'endsOn', message: 'Das Ende liegt vor dem Start.' },
    ]);
    // Its own name, in another case, is fine.
    expect((await updateCampaign(db, campaignId, { name: 'SOMMER' })).name).toBe('SOMMER');
  });

  it('says when the campaign does not exist', async () => {
    await expect(updateCampaign(db, UNKNOWN, { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});

describe('deleteCampaign', () => {
  it('deletes a campaign without jobs, without typing anything', async () => {
    const { customerId, campaignId } = await insertCampaign('Sommer');
    expect(await deleteCampaign(db, campaignId)).toEqual({ runIds: [] });
    expect(await getCampaign(db, campaignId)).toBeNull();
    expect(await listCampaigns(db, customerId)).toEqual([]);
  });

  it('deletes a campaign with its jobs and their runs once "<name> löschen" is typed', async () => {
    const { customerId, campaignId } = await insertCampaign('Sommer');
    const other = await createCampaign(db, { customerId, name: 'Winter' });
    const job = await jobIn(campaignId);
    await jobIn(campaignId, 'Newsletter');
    const kept = await jobIn(other.id, 'Bleibt');
    const [run] = await db
      .insert(runs)
      .values({ jobId: job.id, runNr: 1, device: 'desktop', scheduledAt: new Date() })
      .returning({ id: runs.id });

    expect(campaignDeletePhrase('Sommer')).toBe('Sommer löschen');
    expect(await deleteCampaign(db, campaignId, '  Sommer löschen ')).toEqual({
      runIds: [run?.id],
    });
    expect(await getCampaign(db, campaignId)).toBeNull();
    expect(await db.select({ id: jobs.id }).from(jobs)).toEqual([{ id: kept.id }]);
    expect(await db.select().from(runs)).toEqual([]);
  });

  it('keeps a campaign with jobs while the phrase is missing or wrong', async () => {
    const { campaignId } = await insertCampaign('Sommer');
    await jobIn(campaignId);
    for (const typed of [undefined, '', 'sommer löschen', 'Sommer']) {
      expect(await issuesOf(deleteCampaign(db, campaignId, typed))).toEqual([
        {
          path: 'confirm',
          message: 'Die Kampagne hat noch 1 Test. Zum Löschen „Sommer löschen“ eintippen.',
        },
      ]);
    }
    await jobIn(campaignId, 'Zweiter');
    expect(await issuesOf(deleteCampaign(db, campaignId))).toEqual([
      {
        path: 'confirm',
        message: 'Die Kampagne hat noch 2 Tests. Zum Löschen „Sommer löschen“ eintippen.',
      },
    ]);
    expect(await getCampaign(db, campaignId)).not.toBeNull();
    expect(await db.select().from(jobs)).toHaveLength(2);
  });

  it('says when the campaign does not exist', async () => {
    await expect(deleteCampaign(db, UNKNOWN)).rejects.toThrow(NotFoundError);
  });
});

describe('moving a job to another campaign', () => {
  const edit = (id: string, campaignId?: string) =>
    updateJob(db, id, {
      name: 'Kontakt',
      startUrl: 'https://beispiel.de',
      flow,
      schedule,
      devices: ['desktop'],
      ...(campaignId === undefined ? {} : { campaignId }),
    });

  it('moves a job within its project, and keeps the campaign when none is given', async () => {
    const { customerId, campaignId } = await insertCampaign('Allgemein');
    const sale = await createCampaign(db, { customerId, name: 'Black Friday' });
    const job = await jobIn(campaignId);

    expect((await edit(job.id, sale.id)).campaignId).toBe(sale.id);
    expect((await edit(job.id)).campaignId).toBe(sale.id);
  });

  it('refuses a campaign of another project or one that does not exist', async () => {
    const { campaignId } = await insertCampaign('Allgemein');
    const other = await createCustomer(db, { name: 'Anderes Projekt' });
    const [foreign] = await listCampaigns(db, other.id);
    const job = await jobIn(campaignId);

    for (const target of [foreign?.id ?? '', UNKNOWN]) {
      expect(await issuesOf(edit(job.id, target))).toEqual([
        { path: 'campaignId', message: 'Kampagne nicht gefunden.' },
      ]);
    }
    expect((await getJob(db, job.id)).campaignId).toBe(campaignId);
  });
});

describe('deleteJob', () => {
  it('deletes a job with its runs and returns the ids of the runs, for their screenshots', async () => {
    const { campaignId } = await insertCampaign();
    const job = await jobIn(campaignId);
    const [run] = await db
      .insert(runs)
      .values({ jobId: job.id, runNr: 1, device: 'desktop', scheduledAt: new Date() })
      .returning({ id: runs.id });

    expect(await deleteJob(db, job.id)).toEqual({ runIds: [run?.id] });
    await expect(getJob(db, job.id)).rejects.toThrow(NotFoundError);
    expect(await db.select().from(runs)).toEqual([]);
  });

  it('says when the job does not exist', async () => {
    await expect(deleteJob(db, UNKNOWN)).rejects.toThrow(NotFoundError);
  });
});
