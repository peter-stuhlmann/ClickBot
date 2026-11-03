import { expandSchedule } from '@click-bot/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
import { createJob, getJob, type Job } from './jobs';
import {
  claimNextRun,
  completeRun,
  getWorkerStatus,
  planDueRuns,
  recordHeartbeat,
  recoverStaleRuns,
} from './queue';
import { jobs, runSteps, runs } from './schema';

const now = new Date('2026-11-05T12:30:00Z');
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);
const MIN = 60_000;

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: '/kontakt' }] };

async function activeJob(schedule: unknown, overrides: Record<string, unknown> = {}): Promise<Job> {
  const { campaignId } = await insertCampaign();
  const job = await createJob(db, {
    campaignId,
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de',
    flow,
    schedule,
    ...overrides,
  });
  await db.update(jobs).set({ status: 'active' }).where(eq(jobs.id, job.id));
  return getJob(db, job.id);
}

// 13:24 and 13:38 Berlin = 12:24 and 12:38 UTC.
const wave = (bots = 3) => ({
  type: 'times',
  slots: [
    { date: '2026-11-05', time: '13:31', bots },
    { date: '2026-11-05', time: '13:38', bots: 1 },
  ],
  staggerSeconds: 10,
});

const allRuns = () => db.select().from(runs).orderBy(runs.runNr);

describe('planDueRuns', () => {
  it('queues the bots of a wave that starts within the look-ahead, staggered', async () => {
    await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });

    const queued = await allRuns();
    expect(queued.map((r) => [r.runNr, r.slotIndex, r.botNr, r.status])).toEqual([
      [1, 0, 1, 'queued'],
      [2, 0, 2, 'queued'],
      [3, 0, 3, 'queued'],
    ]);
    expect(queued.map((r) => r.scheduledAt.toISOString())).toEqual([
      '2026-11-05T12:31:00.000Z',
      '2026-11-05T12:31:10.000Z',
      '2026-11-05T12:31:20.000Z',
    ]);
  });

  it('does not queue starts further ahead than the look-ahead', async () => {
    await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 30_000 });
    expect(await allRuns()).toHaveLength(0);
  });

  it('is idempotent: planning twice queues every start once', async () => {
    await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    await planDueRuns(db, { now: at(5_000), lookaheadMs: 2 * MIN });
    expect(await allRuns()).toHaveLength(3);
  });

  it('never queues a start twice when two schedulers plan at the same moment', async () => {
    await activeJob(wave(6));
    await Promise.all([
      planDueRuns(db, { now, lookaheadMs: 2 * MIN }),
      planDueRuns(db, { now, lookaheadMs: 2 * MIN }),
    ]);
    const queued = await allRuns();
    expect(queued).toHaveLength(6);
    expect(queued.map((r) => r.runNr)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('runs every bot on every device of the job', async () => {
    await activeJob(wave(2), { devices: ['desktop', 'iphone'] });
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    expect((await allRuns()).map((r) => `${r.botNr}-${r.device}`).sort()).toEqual([
      '1-desktop',
      '1-iphone',
      '2-desktop',
      '2-iphone',
    ]);
  });

  it('runs every device in each of its own browsers, iPhone once in Safari', async () => {
    await activeJob(wave(1), {
      devices: ['desktop', 'iphone', 'android'],
      deviceBrowsers: { desktop: ['chromium', 'firefox'], android: ['firefox'] },
    });
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    expect((await allRuns()).map((r) => `${r.device}-${r.browser}`).sort()).toEqual([
      'android-firefox',
      'desktop-chromium',
      'desktop-firefox',
      'iphone-webkit',
    ]);
  });

  it('plans a browser added later only for the starts it has not run yet', async () => {
    const job = await activeJob(wave(1), {
      devices: ['desktop'],
      deviceBrowsers: { desktop: ['chromium'] },
    });
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    await db
      .update(jobs)
      .set({ deviceBrowsers: { desktop: ['chromium', 'webkit'] } })
      .where(eq(jobs.id, job.id));
    await planDueRuns(db, { now: at(5_000), lookaheadMs: 2 * MIN });
    expect((await allRuns()).map((r) => r.browser).sort()).toEqual(['chromium', 'webkit']);
  });

  it('ignores paused, draft and finished jobs', async () => {
    const job = await activeJob(wave());
    for (const status of ['paused', 'draft', 'finished'] as const) {
      await db.update(jobs).set({ status }).where(eq(jobs.id, job.id));
      await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    }
    expect(await allRuns()).toHaveLength(0);
  });

  it('skips starts that were missed longer ago than the grace period', async () => {
    await activeJob({
      type: 'interval',
      everyMinutes: 15,
      maxRuns: 3,
      startAt: '2026-11-05T12:00:00Z', // 12:00, 12:15, 12:30
    });
    await planDueRuns(db, { now, lookaheadMs: 0, graceMs: 10 * MIN });
    expect((await allRuns()).map((r) => r.scheduledAt.toISOString())).toEqual([
      '2026-11-05T12:30:00.000Z',
    ]);
  });

  it('finishes a job once its last start has passed and nothing is left to run', async () => {
    const job = await activeJob({
      type: 'interval',
      everyMinutes: 15,
      maxRuns: 1,
      startAt: '2026-11-05T12:30:00Z',
    });
    await planDueRuns(db, { now, lookaheadMs: 0 });
    expect((await getJob(db, job.id)).status).toBe('active');

    const claimed = await claimNextRun(db, now);
    await completeRun(db, claimed?.run.id as string, {
      status: 'passed',
      finishedAt: at(10_000),
      steps: [],
    });
    await planDueRuns(db, { now: at(20_000), lookaheadMs: 0 });

    expect((await getJob(db, job.id)).status).toBe('finished');
  });

  it('keeps a job active while later starts are still ahead', async () => {
    const job = await activeJob(wave());
    await planDueRuns(db, { now: at(-60 * MIN), lookaheadMs: 0 });
    expect((await getJob(db, job.id)).status).toBe('active');
  });
});

describe('claimNextRun', () => {
  it('hands out the earliest due run and marks it running', async () => {
    const job = await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });

    const claimed = await claimNextRun(db, at(2 * MIN));

    expect(claimed?.run).toMatchObject({ botNr: 1, status: 'running', startedAt: at(2 * MIN) });
    expect(claimed?.job).toMatchObject({
      id: job.id,
      name: 'Kontaktformular-Test',
      customerId: job.customerId,
      startUrl: 'https://beispiel.de',
    });
    expect(claimed?.job.flow.steps[0]?.id).toBe('open');
  });

  it('records on the run the GA4 marking it runs with, so later changes of the job do not alter it', async () => {
    const job = await activeJob(wave(), { analyticsMarking: { debugMode: false } });
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const claimed = await claimNextRun(db, at(2 * MIN));

    const marking = { debugMode: false, internalTraffic: true, botFlag: true, runNumber: true };
    expect(claimed?.job.analyticsMarking).toEqual(marking);
    expect(claimed?.run.analyticsMarking).toEqual(marking);

    await db
      .update(jobs)
      .set({ analyticsMarking: { ...marking, botFlag: false } })
      .where(eq(jobs.id, job.id));
    const [stored] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, claimed?.run.id as string));
    expect(stored?.analyticsMarking).toEqual(marking);
  });

  it('tells the worker whether the job wants a video of its runs', async () => {
    await activeJob(wave(1), { recordVideo: true });
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    expect((await claimNextRun(db, at(2 * MIN)))?.job.recordVideo).toBe(true);
  });

  it('records on the run whether it blocks ads, and how many requests it blocked', async () => {
    const job = await activeJob(wave(), { blockAds: false });
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const claimed = await claimNextRun(db, at(2 * MIN));
    expect(claimed?.job.blockAds).toBe(false);
    expect(claimed?.run.adsBlocked).toBe(false);

    await db.update(jobs).set({ blockAds: true }).where(eq(jobs.id, job.id));
    await completeRun(db, claimed?.run.id as string, {
      status: 'passed',
      finishedAt: at(3 * MIN),
      steps: [],
      blockedAdRequests: 0,
    });
    const [stored] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, claimed?.run.id as string));
    expect(stored).toMatchObject({ adsBlocked: false, blockedAdRequests: 0 });
  });

  it('stores the number of blocked ad requests of a run that blocked ads', async () => {
    await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const claimed = await claimNextRun(db, at(2 * MIN));
    expect(claimed?.run.adsBlocked).toBe(true);
    await completeRun(db, claimed?.run.id as string, {
      status: 'passed',
      finishedAt: at(3 * MIN),
      steps: [],
      blockedAdRequests: 7,
    });
    const [stored] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, claimed?.run.id as string));
    expect(stored?.blockedAdRequests).toBe(7);
  });

  it('does not hand out runs before their time', async () => {
    await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    expect(await claimNextRun(db, now)).toBeNull();
  });

  it('hands each run to exactly one of several workers asking at once', async () => {
    await activeJob(wave(3));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });

    const claims = await Promise.all(
      Array.from({ length: 5 }, () => claimNextRun(db, at(5 * MIN))),
    );
    const ids = claims.filter((c) => c !== null).map((c) => c.run.id);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('does not run a queued run of a job that was paused meanwhile', async () => {
    const job = await activeJob(wave());
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    await db.update(jobs).set({ status: 'paused' }).where(eq(jobs.id, job.id));

    expect(await claimNextRun(db, at(5 * MIN))).toBeNull();
  });
});

describe('completeRun', () => {
  it('stores "nicht bestanden": the flow ran, but the expectation was not met', async () => {
    await activeJob(wave(1));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const runId = (await claimNextRun(db, at(2 * MIN)))?.run.id as string;
    const reason = 'Nicht erfüllt: Der Preis stimmt nicht.';

    await completeRun(db, runId, {
      status: 'not_passed',
      finishedAt: at(2 * MIN + 5_000),
      error: reason,
      steps: [
        {
          stepId: 'open',
          index: 0,
          status: 'passed',
          durationMs: 800,
          message: null,
          screenshotPath: null,
        },
        {
          stepId: 'send',
          index: 1,
          status: 'failed',
          durationMs: 900,
          message: reason,
          screenshotPath: null,
        },
      ],
    });

    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run).toMatchObject({ status: 'not_passed', error: reason });
  });

  it('stores the verdict and every step', async () => {
    await activeJob(wave(1));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const claimed = await claimNextRun(db, at(2 * MIN));
    const runId = claimed?.run.id as string;

    await completeRun(db, runId, {
      status: 'failed',
      finishedAt: at(2 * MIN + 9_000),
      error: 'Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).',
      steps: [
        {
          stepId: 'open',
          index: 0,
          status: 'passed',
          durationMs: 812,
          message: null,
          screenshotPath: null,
        },
        {
          stepId: 'send',
          index: 1,
          status: 'failed',
          durationMs: 10_004,
          message: 'Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).',
          screenshotPath: 'runs/abc/send.png',
        },
      ],
    });

    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run).toMatchObject({ status: 'failed', finishedAt: at(2 * MIN + 9_000) });
    expect(run?.error).toContain('Absenden');
    const steps = await db.select().from(runSteps).orderBy(runSteps.stepIndex);
    expect(steps.map((s) => [s.stepId, s.status, s.screenshotPath])).toEqual([
      ['open', 'passed', null],
      ['send', 'failed', 'runs/abc/send.png'],
    ]);
  });

  it('stores where the video of the run lies', async () => {
    await activeJob(wave(1));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const runId = (await claimNextRun(db, at(2 * MIN)))?.run.id as string;
    await completeRun(db, runId, {
      status: 'passed',
      finishedAt: at(3 * MIN),
      steps: [],
      videoPath: `runs/${runId}/video.mp4`,
      videoCues: [{ step: 0, from: 0, to: 1_200 }],
    });
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run?.videoPath).toBe(`runs/${runId}/video.mp4`);
    expect(run?.videoCues).toEqual([{ step: 0, from: 0, to: 1_200 }]);
  });

  it('stores what the AI did in an AI step, for the report', async () => {
    await activeJob(wave(1));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const claimed = await claimNextRun(db, at(2 * MIN));
    const actions = ['Klick auf Rolle „button“ mit Name „Einwilligen“: ok', 'Fertig: Erledigt.'];
    await completeRun(db, claimed?.run.id as string, {
      status: 'passed',
      finishedAt: at(3 * MIN),
      steps: [
        {
          stepId: 'ki',
          index: 0,
          status: 'passed',
          durationMs: 4_000,
          message: null,
          screenshotPath: null,
          aiActions: actions,
        },
        {
          stepId: 'ziel',
          index: 1,
          status: 'unclear',
          durationMs: 9_000,
          message: null,
          screenshotPath: null,
          aiVerdict: [{ goal: 'Captcha-frei', status: 'unknown', evidence: 'Captcha.' }],
          aiSummary: 'Die Anmeldung ließ sich nicht prüfen: Captcha.',
        },
      ],
    });
    const [step, goal] = await db.select().from(runSteps).orderBy(runSteps.stepIndex);
    expect(step?.aiActions).toEqual(actions);
    expect(goal).toMatchObject({
      status: 'unclear',
      aiVerdict: [{ goal: 'Captcha-frei', status: 'unknown', evidence: 'Captcha.' }],
      // The result of the test in one sentence is kept with the step.
      aiSummary: 'Die Anmeldung ließ sich nicht prüfen: Captcha.',
    });
    expect(step?.aiSummary).toBeNull();
  });

  it('refuses to complete a run that is not running', async () => {
    await activeJob(wave(1));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    const [queued] = await allRuns();
    await expect(
      completeRun(db, queued?.id as string, { status: 'passed', finishedAt: now, steps: [] }),
    ).rejects.toThrow('läuft nicht');
  });
});

describe('recoverStaleRuns', () => {
  it('fails runs that have been running for too long, e.g. after a worker crash', async () => {
    await activeJob(wave(2));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    await claimNextRun(db, at(2 * MIN));
    await claimNextRun(db, at(14 * MIN));

    const recovered = await recoverStaleRuns(db, { now: at(20 * MIN), staleAfterMs: 15 * MIN });

    expect(recovered).toBe(1);
    const statuses = (await allRuns()).map((r) => [r.botNr, r.status]);
    expect(statuses).toEqual([
      [1, 'failed'],
      [2, 'running'],
    ]);
    const [failed] = await allRuns();
    expect(failed?.error).toBe(
      'Durchlauf abgebrochen: Das Testsystem wurde während des Durchlaufs beendet.',
    );
  });
});

describe('worker status', () => {
  it('is offline without heartbeat', async () => {
    expect(await getWorkerStatus(db, now)).toEqual({ online: false, activeRuns: 0 });
  });

  it('is online after a recent heartbeat and counts running runs', async () => {
    await activeJob(wave(2));
    await planDueRuns(db, { now, lookaheadMs: 2 * MIN });
    await claimNextRun(db, at(2 * MIN));
    await recordHeartbeat(db, { workerId: 'worker-1', startedAt: now, now: at(2 * MIN) });

    expect(await getWorkerStatus(db, at(2 * MIN + 10_000))).toEqual({
      online: true,
      activeRuns: 1,
    });
  });

  it('goes offline when the last heartbeat is too old', async () => {
    await recordHeartbeat(db, { workerId: 'worker-1', startedAt: now, now });
    expect((await getWorkerStatus(db, at(31_000))).online).toBe(false);
  });

  it('updates the heartbeat of the same worker instead of adding rows', async () => {
    await recordHeartbeat(db, { workerId: 'worker-1', startedAt: now, now });
    await recordHeartbeat(db, { workerId: 'worker-1', startedAt: now, now: at(25_000) });
    expect((await getWorkerStatus(db, at(50_000))).online).toBe(true);
  });
});

describe('planDueRuns – random plans', () => {
  it('plans a drawn start like any other, once it is due', async () => {
    const job = await activeJob({
      type: 'random',
      from: '2026-11-05',
      to: '2026-11-06',
      runs: 5,
      seed: 3,
      drawFrom: now.toISOString(),
    });
    const [first] = expandSchedule(job.schedule);
    if (!first) throw new Error('no start');
    await planDueRuns(db, { now: first.at, lookaheadMs: 0 });
    expect((await allRuns()).map((run) => [run.slotIndex, run.scheduledAt.getTime()])).toEqual([
      [0, first.at.getTime()],
    ]);
  });
});
