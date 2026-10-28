import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { createCustomer, getCustomerStats, listCustomerOverview, slugify } from './customers';
import { ValidationError } from './errors';
import { createJob } from './jobs';
import { customers, jobs, runs } from './schema';

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

async function jobFor(
  customerId: string,
  startUrl: string,
  status: 'active' | 'finished' | 'draft' = 'active',
) {
  const job = await createJob(db, { customerId, name: startUrl, startUrl, flow, schedule });
  await db.update(jobs).set({ status }).where(eq(jobs.id, job.id));
  return job;
}

let runNr = 0;
async function run(
  jobId: string,
  status: 'passed' | 'warning' | 'failed' | 'queued',
  finishedAt: Date | null,
) {
  runNr += 1;
  const [row] = await db
    .insert(runs)
    .values({ jobId, runNr, device: 'desktop', status, scheduledAt: finishedAt ?? now, finishedAt })
    .returning();
  return row;
}

describe('createCustomer', () => {
  it('creates a customer with a short name for URLs', async () => {
    const customer = await createCustomer(db, { name: '  Müller Shop ' });
    expect(customer).toMatchObject({ name: 'Müller Shop', slug: 'mueller-shop' });
  });

  it('numbers the short name when it is taken', async () => {
    await createCustomer(db, { name: 'Nordlicht Hotel' });
    await db.insert(customers).values({ name: 'Nordlicht', slug: 'nordlicht-hotel-2' });
    expect((await createCustomer(db, { name: 'Nordlicht-Hotel' })).slug).toBe('nordlicht-hotel-3');
  });

  it.each([
    ['   ', 'Name fehlt.'],
    ['x'.repeat(121), 'Name ist zu lang (höchstens 120 Zeichen).'],
  ])('rejects the name %j', async (name, message) => {
    const error = await createCustomer(db, { name }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([{ path: 'name', message }]);
  });

  it('rejects a second customer with the same name, whatever the case', async () => {
    await createCustomer(db, { name: 'Stadtwerke Süd' });
    const error = await createCustomer(db, { name: 'stadtwerke süd' }).catch((e: unknown) => e);
    expect((error as ValidationError).issues).toEqual([
      { path: 'name', message: 'Diesen Kunden gibt es schon.' },
    ]);
  });
});

describe('slugify', () => {
  it.each([
    ['Müller Shop', 'mueller-shop'],
    ['Straße & Söhne GmbH', 'strasse-soehne-gmbh'],
    ['Café Crème', 'cafe-creme'],
    ['  --  ', 'kunde'],
  ])('%j → %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});

describe('listCustomerOverview', () => {
  it('summarises jobs, websites, runs of 30 days and the last run per customer', async () => {
    const shop = await insertCustomer('Müller Shop', 'mueller-shop');
    const hotel = await insertCustomer('Nordlicht Hotel', 'nordlicht-hotel');
    const a = await jobFor(shop.id, 'https://mueller-shop.de/kontakt');
    const b = await jobFor(shop.id, 'https://mueller-shop.de/login', 'finished');
    await jobFor(shop.id, 'https://staging.mueller-shop.de/', 'draft');
    await run(a.id, 'passed', daysAgo(1));
    await run(b.id, 'failed', daysAgo(2));
    const last = await run(a.id, 'warning', daysAgo(0.5));
    await run(a.id, 'passed', daysAgo(40)); // older than 30 days
    await run(a.id, 'queued', null);

    const rows = await listCustomerOverview(db, now);

    expect(rows.map((row) => row.name)).toEqual(['Müller Shop', 'Nordlicht Hotel']);
    expect(rows[0]).toMatchObject({
      id: shop.id,
      jobs: { total: 3, active: 1, finished: 1 },
      hosts: ['mueller-shop.de', 'staging.mueller-shop.de'],
      runs30d: { finished: 3, successful: 2 },
      lastRun: { id: last?.id, status: 'warning', finishedAt: daysAgo(0.5) },
    });
    expect(rows[1]).toMatchObject({
      id: hotel.id,
      jobs: { total: 0, active: 0, finished: 0 },
      hosts: [],
      runs30d: { finished: 0, successful: 0 },
      lastRun: null,
    });
  });
});

describe('getCustomerStats', () => {
  it('counts customers, new ones this month, jobs and runs of 30 days against the 30 before', async () => {
    const old = await insertCustomer('Alt', 'alt');
    await db
      .update(customers)
      .set({ createdAt: new Date('2026-10-31T22:59:00Z') })
      .where(eq(customers.id, old.id)); // 23:59 on 31 Oct in Berlin
    const fresh = await insertCustomer('Neu', 'neu');
    await db
      .update(customers)
      .set({ createdAt: new Date('2026-10-31T23:00:00Z') })
      .where(eq(customers.id, fresh.id)); // 00:00 on 1 Nov in Berlin
    const a = await jobFor(old.id, 'https://alt.de');
    await jobFor(fresh.id, 'https://neu.de', 'finished');
    await run(a.id, 'passed', daysAgo(1));
    await run(a.id, 'failed', daysAgo(29));
    await run(a.id, 'passed', daysAgo(31));
    await run(a.id, 'passed', daysAgo(59));
    await run(a.id, 'passed', daysAgo(45));
    await run(a.id, 'passed', daysAgo(61)); // too old for both periods

    expect(await getCustomerStats(db, now)).toEqual({
      customers: 2,
      newThisMonth: 1,
      jobs: { total: 2, active: 1, finished: 1 },
      runs30d: 2,
      runsPrevious30d: 3,
      successRate30d: { successful: 1, finished: 2 },
    });
  });
});
