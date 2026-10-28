import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { ValidationError } from './errors';
import { createJob, type Job } from './jobs';
import { getDashboardStats, listJobOverview, setJobActive } from './overview';
import { jobs, runs } from './schema';
import { eq } from 'drizzle-orm';

// Wednesday, 5 Nov 2026, 13:30 in Berlin (UTC+1).
const now = new Date('2026-11-05T12:30:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: 'https://beispiel.de' }] };

async function job(name: string, overrides: Record<string, unknown> = {}): Promise<Job> {
  const customer = await insertCustomer(`Kunde ${name}`, `kunde-${name.toLowerCase()}`);
  return createJob(db, {
    customerId: customer.id,
    name,
    startUrl: 'https://beispiel.de/kontakt',
    flow,
    schedule: { type: 'interval', everyMinutes: 15, maxRuns: 20, startAt: '2026-11-05T10:00:00Z' },
    ...overrides,
  });
}

let runNr = 0;
async function finishedRun(
  jobId: string,
  status: 'passed' | 'warning' | 'failed' | 'cancelled',
  finishedAt: Date,
) {
  runNr += 1;
  await db.insert(runs).values({
    jobId,
    runNr,
    // A scheduled run: one start of the interval each.
    slotIndex: runNr,
    device: 'desktop',
    status,
    scheduledAt: finishedAt,
    startedAt: new Date(finishedAt.getTime() - 8_000),
    finishedAt,
  });
}

describe('listJobOverview', () => {
  it('summarises progress, last run and success rate per job', async () => {
    const contact = await job('Kontakt');
    await finishedRun(contact.id, 'passed', minutesAgo(33));
    await finishedRun(contact.id, 'failed', minutesAgo(18));
    await finishedRun(contact.id, 'warning', minutesAgo(3));

    const [row] = await listJobOverview(db);

    expect(row).toMatchObject({
      name: 'Kontakt',
      customerName: 'Kunde Kontakt',
      runsDone: 3,
      runsPlanned: 20,
      lastRun: { id: expect.any(String), status: 'warning', finishedAt: minutesAgo(3) },
    });
    // Warnings count as success: the site worked, the AI only had to help once.
    expect(row?.successRate).toBeCloseTo(2 / 3);
  });

  it('counts planned runs for every device', async () => {
    await job('Mobil', { devices: ['desktop', 'iphone'] });
    const [row] = await listJobOverview(db);
    expect(row?.runsPlanned).toBe(40);
  });

  it('counts the bots of all slots for a schedule by dates', async () => {
    await job('Termine', {
      schedule: {
        type: 'times',
        slots: [
          { date: '2026-11-05', time: '13:24', bots: 3 },
          { date: '2026-11-05', time: '13:38', bots: 6 },
        ],
      },
    });
    const [row] = await listJobOverview(db);
    expect(row?.runsPlanned).toBe(9);
  });

  it('ignores cancelled and unfinished runs for progress and success rate', async () => {
    const contact = await job('Kontakt');
    await finishedRun(contact.id, 'passed', minutesAgo(30));
    await finishedRun(contact.id, 'cancelled', minutesAgo(20));
    await db.insert(runs).values({
      jobId: contact.id,
      runNr: 99,
      device: 'desktop',
      status: 'running',
      scheduledAt: minutesAgo(1),
    });

    const [row] = await listJobOverview(db);
    expect(row).toMatchObject({ runsDone: 1, successRate: 1 });
    expect(row?.lastRun?.status).toBe('passed');
  });

  it('has no last run and no success rate for a job that never ran', async () => {
    await job('Neu');
    const [row] = await listJobOverview(db);
    expect(row).toMatchObject({ runsDone: 0, lastRun: null, successRate: null });
  });

  it('lists jobs in the order they were created', async () => {
    await job('Erster');
    await job('Zweiter');
    expect((await listJobOverview(db)).map((row) => row.name)).toEqual(['Erster', 'Zweiter']);
  });
});

describe('getDashboardStats', () => {
  it('counts active and finished jobs', async () => {
    const a = await job('A');
    const b = await job('B');
    await job('C');
    await db.update(jobs).set({ status: 'active' }).where(eq(jobs.id, a.id));
    await db.update(jobs).set({ status: 'finished' }).where(eq(jobs.id, b.id));

    expect(await getDashboardStats(db, now)).toMatchObject({ activeJobs: 1, finishedJobs: 1 });
  });

  it('counts runs of today and yesterday by Berlin time, not UTC', async () => {
    const a = await job('A');
    await finishedRun(a.id, 'passed', new Date('2026-11-04T23:30:00Z')); // 00:30 today in Berlin
    await finishedRun(a.id, 'passed', new Date('2026-11-04T22:30:00Z')); // 23:30 yesterday
    await finishedRun(a.id, 'failed', new Date('2026-11-04T10:00:00Z')); // yesterday
    await finishedRun(a.id, 'passed', new Date('2026-11-03T22:59:00Z')); // day before yesterday

    expect(await getDashboardStats(db, now)).toMatchObject({ runsToday: 1, runsYesterday: 2 });
  });

  it('computes the success rate of the last 7 days', async () => {
    const a = await job('A');
    await finishedRun(a.id, 'passed', minutesAgo(60));
    await finishedRun(a.id, 'warning', minutesAgo(120));
    await finishedRun(a.id, 'failed', minutesAgo(180));
    await finishedRun(a.id, 'failed', minutesAgo(8 * 24 * 60)); // older than 7 days

    expect((await getDashboardStats(db, now)).successRate7d).toEqual({
      successful: 2,
      finished: 3,
    });
  });

  it('lists failures of the last 24 hours with the affected jobs, once each', async () => {
    const login = await job('Login');
    const shop = await job('Shop');
    await finishedRun(login.id, 'failed', minutesAgo(25));
    await finishedRun(login.id, 'failed', minutesAgo(90));
    await finishedRun(shop.id, 'failed', minutesAgo(25 * 60)); // too old
    await finishedRun(shop.id, 'passed', minutesAgo(10));

    expect((await getDashboardStats(db, now)).failures24h).toEqual({
      count: 2,
      jobNames: ['Login'],
    });
  });

  it('returns zeros for an empty database', async () => {
    expect(await getDashboardStats(db, now)).toEqual({
      activeJobs: 0,
      finishedJobs: 0,
      runsToday: 0,
      runsYesterday: 0,
      successRate7d: { successful: 0, finished: 0 },
      failures24h: { count: 0, jobNames: [] },
    });
  });
});

describe('setJobActive', () => {
  it('pauses an active job and resumes it again', async () => {
    const a = await job('A');
    await db.update(jobs).set({ status: 'active' }).where(eq(jobs.id, a.id));

    expect((await setJobActive(db, a.id, false)).status).toBe('paused');
    expect((await setJobActive(db, a.id, true)).status).toBe('active');
  });

  it.each(['draft', 'finished'] as const)('refuses to toggle a %s job', async (status) => {
    const a = await job('A');
    await db.update(jobs).set({ status }).where(eq(jobs.id, a.id));

    const error = await setJobActive(db, a.id, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues[0]?.path).toBe('status');
  });

  it('throws for an unknown job', async () => {
    await expect(setJobActive(db, '00000000-0000-0000-0000-000000000000', true)).rejects.toThrow(
      'nicht gefunden',
    );
  });
});
