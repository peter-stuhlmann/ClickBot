import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { NotFoundError } from './errors';
import { createJob, type Job } from './jobs';
import { listJobOverview } from './overview';
import { claimNextRun, completeRun } from './queue';
import { jobs, runs } from './schema';
import { queueTestRun } from './test-runs';

const now = new Date('2026-11-05T12:30:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);

async function newJob(
  status: Job['status'] = 'active',
  devices: Job['devices'] = ['iphone', 'desktop'],
) {
  const customer = await insertCustomer();
  const job = await createJob(db, {
    customerId: customer.id,
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de',
    flow: { version: 1, steps: [{ id: 'open', type: 'open', url: '/' }] },
    schedule: { type: 'interval', everyMinutes: 60, maxRuns: 2, startAt: '2026-11-06T08:00:00Z' },
    devices,
  });
  await db.update(jobs).set({ status, runCounter: 4 }).where(eq(jobs.id, job.id));
  return job;
}

describe('queueTestRun', () => {
  it('queues one bot on the first device of the job, due right away, without a date', async () => {
    const job = await newJob();
    const { runId, existing } = await queueTestRun(db, job.id, now);

    expect(existing).toBe(false);
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run).toMatchObject({
      jobId: job.id,
      runNr: 5,
      slotIndex: null,
      botNr: 1,
      device: 'iphone',
      browser: 'webkit',
      status: 'queued',
      scheduledAt: now,
    });
  });

  it('hands out the waiting test run instead of queuing another one', async () => {
    const job = await newJob();
    const first = await queueTestRun(db, job.id, now);
    const again = await queueTestRun(db, job.id, later(5));

    expect(again).toEqual({ runId: first.runId, existing: true });
    expect(await db.select().from(runs)).toHaveLength(1);
  });

  it('queues a new test run once the previous one has finished', async () => {
    const job = await newJob();
    const first = await queueTestRun(db, job.id, now);
    await claimNextRun(db, now);
    await completeRun(db, first.runId, { status: 'passed', finishedAt: later(3), steps: [] });

    const second = await queueTestRun(db, job.id, later(10));
    expect(second.existing).toBe(false);
    expect(second.runId).not.toBe(first.runId);
  });

  it.each([
    ['an unknown', '00000000-0000-0000-0000-000000000000'],
    ['a malformed', 'job-7'],
  ])('throws NotFoundError for %s job', async (_case, id) => {
    await expect(queueTestRun(db, id, now)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('test runs in the queue', () => {
  it.each(['paused', 'draft', 'finished'] as const)(
    'are run for a %s job, because someone asked for them',
    async (status) => {
      const job = await newJob(status);
      const { runId } = await queueTestRun(db, job.id, now);
      expect((await claimNextRun(db, now))?.run.id).toBe(runId);
    },
  );

  it('do not count towards the progress of the schedule, but towards the success rate', async () => {
    const job = await newJob();
    const { runId } = await queueTestRun(db, job.id, now);
    await claimNextRun(db, now);
    await completeRun(db, runId, { status: 'failed', finishedAt: later(3), steps: [] });

    const [row] = await listJobOverview(db);
    expect(row).toMatchObject({ runsDone: 0, runsPlanned: 4, successRate: 0 });
    expect(row?.lastRun?.id).toBe(runId);
  });
});
