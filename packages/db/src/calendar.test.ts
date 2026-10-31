import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign, insertCustomer } from '../test/db';
import { getBrowserLimit, listCalendarJobs, moveSlot } from './calendar';
import { NotFoundError, ValidationError } from './errors';
import { createJob, getJob } from './jobs';
import { setJobActive } from './overview';
import { recordHeartbeat } from './queue';
import { jobs, runs } from './schema';

const now = new Date('2026-11-04T09:00:00Z');
const MIN = 60_000;

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: '/kontakt' }] };

// 13:24 and 13:38 Berlin = 12:24 and 12:38 UTC.
const slotA = { date: '2026-11-05', time: '13:24', bots: 3 };
const slotB = { date: '2026-11-05', time: '13:38', bots: 2 };
const times = (slots = [slotA, slotB]) => ({ type: 'times', slots, staggerSeconds: 10 });

async function newJob(
  overrides: Record<string, unknown> = {},
  campaign?: { campaignId: string },
): Promise<{ id: string }> {
  const { campaignId } = campaign ?? (await insertCampaign());
  return createJob(db, {
    campaignId,
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de',
    flow,
    schedule: times(),
    status: 'active',
    ...overrides,
  });
}

async function finishedRun(jobId: string, runNr: number, seconds: number) {
  const startedAt = new Date(now.getTime() - (runNr + 1) * 60 * MIN);
  await db.insert(runs).values({
    jobId,
    runNr,
    botNr: 1,
    device: 'desktop',
    status: 'passed',
    scheduledAt: startedAt,
    startedAt,
    finishedAt: new Date(startedAt.getTime() + seconds * 1000),
  });
}

describe('listCalendarJobs', () => {
  it('lists active and finished jobs of every project with what the calendar needs', async () => {
    const müller = await insertCustomer('Müller Shop', 'mueller-shop');
    const job = await newJob(
      { devices: ['desktop', 'iphone'] },
      await insertCampaign('Allgemein', müller),
    );

    const [row, ...rest] = await listCalendarJobs(db, now);
    expect(rest).toEqual([]);
    expect(row).toEqual({
      id: job.id,
      name: 'Kontaktformular-Test',
      customerId: müller.id,
      customerName: 'Müller Shop',
      schedule: expect.objectContaining({ type: 'times' }),
      devices: ['desktop', 'iphone'],
      deviceBrowsers: { desktop: ['chromium'], iphone: ['webkit'] },
      typicalRunMs: null,
    });
  });

  it('leaves out drafts and paused jobs, whose starts do not happen', async () => {
    const campaign = await insertCampaign();
    await newJob({ name: 'Entwurf', status: 'draft' }, campaign);
    await newJob({ name: 'Läuft' }, campaign);
    const finished = await newJob({ name: 'Fertig' }, campaign);
    await db.update(jobs).set({ status: 'finished' }).where(eq(jobs.id, finished.id));
    const paused = await newJob({ name: 'Pausiert' }, campaign);
    await setJobActive(db, paused.id, false);

    const names = (await listCalendarJobs(db, now)).map((job) => job.name);
    expect(names).toEqual(['Läuft', 'Fertig']);
  });

  it('takes the typical length of a run from the median of the last 30 days', async () => {
    const job = await newJob();
    await finishedRun(job.id, 1, 20);
    await finishedRun(job.id, 2, 40);
    await finishedRun(job.id, 3, 600);
    const old = new Date(now.getTime() - 40 * 24 * 60 * MIN);
    await db.insert(runs).values({
      jobId: job.id,
      runNr: 4,
      botNr: 1,
      device: 'desktop',
      status: 'passed',
      scheduledAt: old,
      startedAt: old,
      finishedAt: new Date(old.getTime() + 3_600_000),
    });

    const [row] = await listCalendarJobs(db, now);
    expect(row?.typicalRunMs).toBe(40_000);
  });
});

describe('moveSlot', () => {
  const move = (jobId: string, to: { date: string; time: string }, from = slotB) =>
    moveSlot(db, jobId, { slotIndex: 1, from, to }, now);

  it('moves a date that has not started yet and keeps its position and bots', async () => {
    const job = await newJob();
    await move(job.id, { date: '2026-11-05', time: '13:45' });

    const saved = await getJob(db, job.id);
    expect(saved.schedule).toMatchObject({
      type: 'times',
      slots: [slotA, { date: '2026-11-05', time: '13:45', bots: 2 }],
    });
    expect(saved.status).toBe('active');
  });

  it('refuses when the date changed in the meantime', async () => {
    const job = await newJob();
    await expect(
      move(job.id, { date: '2026-11-05', time: '13:45' }, { ...slotB, time: '13:39' }),
    ).rejects.toThrow(ValidationError);
  });

  it('refuses a date that already has runs', async () => {
    const job = await newJob();
    await db.insert(runs).values({
      jobId: job.id,
      runNr: 1,
      slotIndex: 1,
      botNr: 1,
      device: 'desktop',
      status: 'queued',
      scheduledAt: new Date('2026-11-05T12:38:00Z'),
    });
    await expect(move(job.id, { date: '2026-11-05', time: '13:45' })).rejects.toThrow(
      'Dieser Termin hat schon Läufe',
    );
  });

  it('refuses a new time in the past or right now', async () => {
    const job = await newJob();
    await expect(move(job.id, { date: '2026-11-04', time: '10:00' })).rejects.toThrow(
      'Der neue Termin liegt nicht in der Zukunft.',
    );
  });

  it('checks the new date like the editor: no duplicate', async () => {
    const job = await newJob();
    await expect(move(job.id, { date: '2026-11-05', time: '13:24' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('only moves dates of a plan by dates', async () => {
    const job = await newJob({
      schedule: { type: 'interval', everyMinutes: 60, maxRuns: 3, startAt: now.toISOString() },
    });
    await expect(move(job.id, { date: '2026-11-05', time: '13:45' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('does not know unknown jobs', async () => {
    await expect(
      move('00000000-0000-0000-0000-000000000000', { date: '2026-11-05', time: '13:45' }),
    ).rejects.toThrow(NotFoundError);
    await expect(move('kein-job', { date: '2026-11-05', time: '13:45' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('getBrowserLimit', () => {
  it('is unknown before a worker reported its limit', async () => {
    expect(await getBrowserLimit(db)).toBeNull();
    await recordHeartbeat(db, { workerId: 'alt', startedAt: now, now });
    expect(await getBrowserLimit(db)).toBeNull();
  });

  it('is the limit of the worker that reported last', async () => {
    await recordHeartbeat(db, { workerId: 'a', startedAt: now, now, maxBrowsers: 4 });
    await recordHeartbeat(db, {
      workerId: 'b',
      startedAt: now,
      now: new Date(now.getTime() + 5000),
      maxBrowsers: 6,
    });
    expect(await getBrowserLimit(db)).toBe(6);
  });
});
