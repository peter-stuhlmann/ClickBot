import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign, insertCustomer } from '../test/db';
import {
  createCampaign,
  getCampaign,
  getCampaignStats,
  listCampaignOverview,
  listCampaigns,
} from './campaigns';
import { createCustomer } from './customers';
import { ValidationError } from './errors';
import { createJob } from './jobs';
import { jobs, runs } from './schema';

// Thursday, 5 Nov 2026, 13:30 in Berlin.
const now = new Date('2026-11-05T12:30:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: '/' }] };
const schedule = {
  type: 'interval',
  everyMinutes: 60,
  maxRuns: 5,
  startAt: '2026-11-05T10:00:00Z',
};

async function jobIn(
  campaignId: string,
  startUrl: string,
  status: 'active' | 'finished' = 'active',
) {
  const job = await createJob(db, { campaignId, name: startUrl, startUrl, flow, schedule });
  await db.update(jobs).set({ status }).where(eq(jobs.id, job.id));
  return job;
}

let runNr = 0;
async function run(jobId: string, status: 'passed' | 'failed' | 'warning', finishedAt: Date) {
  runNr += 1;
  const [row] = await db
    .insert(runs)
    .values({ jobId, runNr, device: 'desktop', status, scheduledAt: finishedAt, finishedAt })
    .returning();
  return row;
}

const issuesOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
};

describe('createCampaign', () => {
  it('creates a campaign in a project, with optional period and note', async () => {
    const shop = await insertCustomer();
    const campaign = await createCampaign(db, {
      customerId: shop.id,
      name: '  Black Friday ',
      startsOn: '2026-11-20',
      endsOn: '2026-11-30',
      description: 'Rabattcode im Checkout prüfen.',
    });
    expect(campaign).toMatchObject({
      customerId: shop.id,
      name: 'Black Friday',
      startsOn: '2026-11-20',
      endsOn: '2026-11-30',
      description: 'Rabattcode im Checkout prüfen.',
    });
  });

  it('needs only a name', async () => {
    const shop = await insertCustomer();
    const campaign = await createCampaign(db, { customerId: shop.id, name: 'Newsletter' });
    expect(campaign).toMatchObject({ startsOn: null, endsOn: null, description: null });
  });

  it('allows the same name in another project, not twice in one, whatever the case', async () => {
    const shop = await insertCustomer('Shop', 'shop');
    const hotel = await insertCustomer('Hotel', 'hotel');
    await createCampaign(db, { customerId: shop.id, name: 'Sommer' });
    await createCampaign(db, { customerId: hotel.id, name: 'Sommer' });
    expect(await issuesOf(createCampaign(db, { customerId: shop.id, name: 'SOMMER' }))).toEqual([
      { path: 'name', message: 'Diese Kampagne gibt es in diesem Projekt schon.' },
    ]);
  });

  it('reports every problem with its field', async () => {
    const shop = await insertCustomer();
    expect(
      await issuesOf(
        createCampaign(db, {
          customerId: shop.id,
          name: ' ',
          startsOn: '2026-11-30',
          endsOn: '2026-11-20',
          description: 'x'.repeat(2001),
        }),
      ),
    ).toEqual([
      { path: 'name', message: 'Name fehlt.' },
      { path: 'endsOn', message: 'Das Ende liegt vor dem Start.' },
      { path: 'description', message: 'Höchstens 2000 Zeichen.' },
    ]);
    expect(
      await issuesOf(
        createCampaign(db, { customerId: shop.id, name: 'X', startsOn: '2026-02-30' }),
      ),
    ).toEqual([{ path: 'startsOn', message: 'Kein gültiges Datum.' }]);
  });

  it('refuses an unknown project', async () => {
    expect(
      await issuesOf(
        createCampaign(db, { customerId: '00000000-0000-0000-0000-000000000000', name: 'X' }),
      ),
    ).toEqual([{ path: 'customerId', message: 'Projekt nicht gefunden.' }]);
  });
});

describe('a new project', () => {
  it('starts with the campaign "Allgemein", so jobs can be created right away', async () => {
    const project = await createCustomer(db, { name: 'Neues Projekt' });
    expect((await listCampaigns(db, project.id)).map((c) => c.name)).toEqual(['Allgemein']);
  });
});

describe('getCampaign', () => {
  it('finds a campaign with its project, and nothing for unknown ids', async () => {
    const { customerId, campaignId } = await insertCampaign('Sommer');
    expect(await getCampaign(db, campaignId)).toMatchObject({ customerId, name: 'Sommer' });
    expect(await getCampaign(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await getCampaign(db, 'kaputt')).toBeNull();
  });
});

describe('listCampaigns', () => {
  it('lists the campaigns of one project by name', async () => {
    const { customerId } = await insertCampaign('Zebra');
    await createCampaign(db, { customerId, name: 'Allgemein' });
    const other = await insertCustomer('Anderes', 'anderes');
    await createCampaign(db, { customerId: other.id, name: 'Fremd' });
    expect((await listCampaigns(db, customerId)).map((c) => c.name)).toEqual([
      'Allgemein',
      'Zebra',
    ]);
  });
});

describe('listCampaignOverview', () => {
  it('summarises jobs, websites, runs of 30 days and the last run per campaign of a project', async () => {
    const { customerId, campaignId: sale } = await insertCampaign('Black Friday');
    const { id: general } = await createCampaign(db, { customerId, name: 'Allgemein' });
    const a = await jobIn(sale, 'https://shop.de/kontakt');
    const b = await jobIn(sale, 'https://shop.de/checkout', 'finished');
    await run(a.id, 'passed', daysAgo(1));
    await run(b.id, 'failed', daysAgo(2));
    const last = await run(a.id, 'warning', daysAgo(0.5));
    await run(a.id, 'passed', daysAgo(40));

    const rows = await listCampaignOverview(db, customerId, now);
    expect(rows.map((row) => row.name)).toEqual(['Allgemein', 'Black Friday']);
    expect(rows[1]).toMatchObject({
      id: sale,
      jobs: { total: 2, active: 1, finished: 1 },
      hosts: ['shop.de'],
      runs30d: { finished: 3, successful: 2 },
      lastRun: { id: last?.id, status: 'warning', finishedAt: daysAgo(0.5) },
    });
    expect(rows[0]).toMatchObject({
      id: general,
      jobs: { total: 0, active: 0, finished: 0 },
      runs30d: { finished: 0, successful: 0 },
      lastRun: null,
    });
  });
});

describe('getCampaignStats', () => {
  it('counts campaigns, jobs and runs of one project, 30 days against the 30 before', async () => {
    const { customerId, campaignId } = await insertCampaign('Sommer');
    await createCampaign(db, { customerId, name: 'Winter' });
    const a = await jobIn(campaignId, 'https://shop.de');
    await jobIn(campaignId, 'https://shop.de/b', 'finished');
    await run(a.id, 'passed', daysAgo(1));
    await run(a.id, 'failed', daysAgo(29));
    await run(a.id, 'passed', daysAgo(31));
    await run(a.id, 'passed', daysAgo(61));
    const other = await insertCampaign('Fremd', await insertCustomer('Anderes', 'anderes'));
    await run((await jobIn(other.campaignId, 'https://x.de')).id, 'passed', daysAgo(1));

    expect(await getCampaignStats(db, customerId, now)).toEqual({
      campaigns: 2,
      jobs: { total: 2, active: 1, finished: 1 },
      runs30d: 2,
      runsPrevious30d: 1,
      successRate30d: { successful: 1, finished: 2 },
    });
  });
});
