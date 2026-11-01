import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
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
  const { campaignId } = await insertCampaign();
  const job = await createJob(db, {
    campaignId,
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
  it('queues one run per device and browser of the job, due right away, without a date', async () => {
    const job = await newJob();
    const { runId, runIds, existing } = await queueTestRun(db, job.id, now);

    expect(existing).toBe(false);
    expect(runIds).toHaveLength(2);
    expect(runId).toBe(runIds[0]);
    const queued = await db.select().from(runs).orderBy(runs.runNr);
    expect(queued.map((run) => run.id)).toEqual(runIds);
    expect(queued).toMatchObject([
      // The iPhone always runs in Safari, the desktop starts in Chrome.
      { jobId: job.id, runNr: 5, slotIndex: null, botNr: 1, device: 'iphone', browser: 'webkit' },
      {
        jobId: job.id,
        runNr: 6,
        slotIndex: null,
        botNr: 1,
        device: 'desktop',
        browser: 'chromium',
      },
    ]);
    // One start: all runs of it share the moment they were queued.
    for (const run of queued) expect(run).toMatchObject({ status: 'queued', scheduledAt: now });
  });

  it('hands out the waiting test runs instead of queuing more', async () => {
    const job = await newJob();
    const first = await queueTestRun(db, job.id, now);
    const again = await queueTestRun(db, job.id, later(5));

    expect(again).toEqual({ runId: first.runId, runIds: first.runIds, existing: true });
    expect(await db.select().from(runs)).toHaveLength(2);
  });

  it('still hands out the start while one of its runs is running and the other has finished', async () => {
    const job = await newJob();
    const first = await queueTestRun(db, job.id, now);
    const claimed = await claimNextRun(db, now);
    await completeRun(db, claimed?.run.id ?? '', {
      status: 'passed',
      finishedAt: later(3),
      steps: [],
    });
    await claimNextRun(db, now);

    const again = await queueTestRun(db, job.id, later(5));
    expect(again.existing).toBe(true);
    expect(again.runIds.sort()).toEqual(first.runIds.slice().sort());
  });

  it('queues a new start once the previous one has finished', async () => {
    const job = await newJob();
    const first = await queueTestRun(db, job.id, now);
    for (const runId of first.runIds) {
      await claimNextRun(db, now);
      await completeRun(db, runId, { status: 'passed', finishedAt: later(3), steps: [] });
    }

    const second = await queueTestRun(db, job.id, later(10));
    expect(second.existing).toBe(false);
    expect(second.runIds).toHaveLength(2);
    expect(second.runIds).not.toContain(first.runId);
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
