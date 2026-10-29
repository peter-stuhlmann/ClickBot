import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { createJob } from './jobs';
import { listRuns } from './run-list';
import { runs } from './schema';

const now = new Date('2026-11-05T12:30:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: '/' }] };
const schedule = {
  type: 'interval',
  everyMinutes: 60,
  maxRuns: 5,
  startAt: '2026-11-05T10:00:00Z',
};

async function setup() {
  const shop = await insertCustomer('Müller Shop', 'mueller-shop');
  const hotel = await insertCustomer('Nordlicht Hotel', 'nordlicht-hotel');
  const newsletter = await createJob(db, {
    customerId: shop.id,
    name: 'Newsletter',
    startUrl: 'https://mueller-shop.de',
    flow,
    schedule,
  });
  const booking = await createJob(db, {
    customerId: hotel.id,
    name: 'Zimmer buchen',
    startUrl: 'https://nordlicht-hotel.de',
    flow,
    schedule,
  });
  const at = (h: number) => ({
    scheduledAt: hoursAgo(h),
    startedAt: hoursAgo(h),
    finishedAt: new Date(hoursAgo(h).getTime() + 8_400),
  });
  await db.insert(runs).values([
    {
      jobId: newsletter.id,
      runNr: 1,
      slotIndex: 0,
      device: 'desktop',
      status: 'passed',
      ...at(30),
    },
    {
      jobId: newsletter.id,
      runNr: 2,
      slotIndex: 1,
      device: 'iphone',
      status: 'failed',
      ...at(5),
      error: 'x',
    },
    { jobId: booking.id, runNr: 1, slotIndex: 0, device: 'desktop', status: 'warning', ...at(3) },
    {
      jobId: booking.id,
      runNr: 2,
      slotIndex: null,
      device: 'android',
      browser: 'chromium',
      status: 'running',
      scheduledAt: hoursAgo(0.1),
      startedAt: hoursAgo(0.1),
    },
    {
      jobId: newsletter.id,
      runNr: 3,
      slotIndex: 2,
      device: 'desktop',
      status: 'queued',
      scheduledAt: hoursAgo(-0.01),
    },
    {
      jobId: booking.id,
      runNr: 3,
      slotIndex: 1,
      device: 'desktop',
      status: 'cancelled',
      ...at(200),
    },
  ]);
  return { shop, hotel, newsletter, booking };
}

const titles = (rows: { jobName: string; runNr: number }[]) =>
  rows.map((row) => `${row.jobName} #${row.runNr}`);

describe('listRuns', () => {
  it('lists all runs of all jobs, newest first, with job and customer', async () => {
    const { booking } = await setup();
    const { rows, total } = await listRuns(db, {});

    expect(total).toBe(6);
    expect(titles(rows)).toEqual([
      'Newsletter #3',
      'Zimmer buchen #2',
      'Zimmer buchen #1',
      'Newsletter #2',
      'Newsletter #1',
      'Zimmer buchen #3',
    ]);
    expect(rows[1]).toMatchObject({
      jobId: booking.id,
      jobName: 'Zimmer buchen',
      customerName: 'Nordlicht Hotel',
      slotIndex: null,
      device: 'android',
      status: 'running',
      finishedAt: null,
    });
  });

  it('filters by customer, result, time and device, and counts all matches', async () => {
    const { shop } = await setup();

    expect(titles((await listRuns(db, { customerId: shop.id })).rows)).toEqual([
      'Newsletter #3',
      'Newsletter #2',
      'Newsletter #1',
    ]);
    expect(titles((await listRuns(db, { statuses: ['failed', 'warning'] })).rows)).toEqual([
      'Zimmer buchen #1',
      'Newsletter #2',
    ]);
    expect(titles((await listRuns(db, { since: hoursAgo(24) })).rows)).toEqual([
      'Newsletter #3',
      'Zimmer buchen #2',
      'Zimmer buchen #1',
      'Newsletter #2',
    ]);
    expect(titles((await listRuns(db, { device: 'iphone' })).rows)).toEqual(['Newsletter #2']);
  });

  it('pages through the runs and still reports the total', async () => {
    await setup();
    const second = await listRuns(db, { limit: 2, offset: 2 });
    expect(second.total).toBe(6);
    expect(titles(second.rows)).toEqual(['Zimmer buchen #1', 'Newsletter #2']);
  });

  it('treats a malformed customer id as no match instead of failing', async () => {
    await setup();
    expect(await listRuns(db, { customerId: 'kunde-7' })).toEqual({ rows: [], total: 0 });
  });
});
