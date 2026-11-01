import { ne } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
import { NotFoundError } from './errors';
import { createJob } from './jobs';
import type { Run } from './queue';
import { getRunReport, getWaveReport } from './reports';
import { runSteps, runs } from './schema';

const flow = {
  version: 1,
  steps: [
    { id: 'open', type: 'open', url: '/kontakt' },
    { id: 'send', type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
  ],
};

async function jobWithRuns() {
  const { campaignId } = await insertCampaign();
  const job = await createJob(db, {
    campaignId,
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de',
    flow,
    schedule: { type: 'interval', everyMinutes: 15, maxRuns: 10, startAt: '2026-11-05T12:00:00Z' },
    devices: ['desktop', 'iphone'],
  });
  const at = (seconds: number) => new Date(Date.UTC(2026, 10, 5, 12, 0, seconds));
  const inserted = await db
    .insert(runs)
    .values([
      {
        jobId: job.id,
        runNr: 1,
        slotIndex: 0,
        device: 'desktop',
        status: 'failed',
        scheduledAt: at(0),
        startedAt: at(1),
        finishedAt: at(5), // 4 s
        error: 'Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).',
      },
      {
        jobId: job.id,
        runNr: 2,
        slotIndex: 0,
        device: 'iphone',
        status: 'passed',
        scheduledAt: at(0),
        startedAt: at(1),
        finishedAt: at(3), // 2 s
      },
      { jobId: job.id, runNr: 3, slotIndex: 1, device: 'desktop', scheduledAt: at(900) },
    ])
    .returning();
  const [failed, passed, queued] = inserted as [Run, Run, Run];
  return { job, failed, passed, queued };
}

describe('getRunReport', () => {
  it('returns the run with its job, its steps in order and the job average', async () => {
    const { job, failed } = await jobWithRuns();
    await db.insert(runSteps).values([
      {
        runId: failed.id,
        stepIndex: 1,
        stepId: 'send',
        status: 'failed',
        durationMs: 3_000,
        message: 'Element nicht gefunden …',
        screenshotPath: `runs/${failed.id}/1-send.png`,
      },
      { runId: failed.id, stepIndex: 0, stepId: 'open', status: 'passed', durationMs: 800 },
    ]);

    const report = await getRunReport(db, failed.id);

    expect(report.run).toMatchObject({ id: failed.id, runNr: 1, status: 'failed' });
    expect(report.job).toMatchObject({
      id: job.id,
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de',
      // 10 interval starts on 2 devices.
      runsPlanned: 20,
    });
    expect(report.job.flow.steps.map((step) => step.id)).toEqual(['open', 'send']);
    expect(report.steps).toEqual([
      {
        stepIndex: 0,
        stepId: 'open',
        status: 'passed',
        durationMs: 800,
        message: null,
        screenshotPath: null,
        aiActions: null,
        aiVerdict: null,
      },
      {
        stepIndex: 1,
        stepId: 'send',
        status: 'failed',
        durationMs: 3_000,
        message: 'Element nicht gefunden …',
        screenshotPath: `runs/${failed.id}/1-send.png`,
        aiActions: null,
        aiVerdict: null,
      },
    ]);
    // (4 s + 2 s) / 2; the queued run does not count.
    expect(report.averageDurationMs).toBe(3_000);
  });

  it('reports a run that has not started yet without steps', async () => {
    const { queued } = await jobWithRuns();
    const report = await getRunReport(db, queued.id);
    expect(report.run.status).toBe('queued');
    expect(report.steps).toEqual([]);
  });

  it('has no average while the job has not finished a run', async () => {
    const { queued } = await jobWithRuns();
    await db.delete(runs).where(ne(runs.id, queued.id));
    expect((await getRunReport(db, queued.id)).averageDurationMs).toBeNull();
  });

  it('counts the runs of the same start, e.g. two devices of one slot', async () => {
    const { failed, queued } = await jobWithRuns();
    expect((await getRunReport(db, failed.id)).waveSize).toBe(2);
    expect((await getRunReport(db, queued.id)).waveSize).toBe(1);
  });

  it.each([
    ['an unknown', '00000000-0000-0000-0000-000000000000'],
    ['a malformed', 'lauf-7'],
  ])('throws NotFoundError for %s id', async (_case, id) => {
    await expect(getRunReport(db, id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getWaveReport', () => {
  it('lists every run of the same slot with device, browser, result and the failed step', async () => {
    const { job, failed, passed } = await jobWithRuns();
    await db.insert(runSteps).values([
      { runId: failed.id, stepIndex: 0, stepId: 'open', status: 'passed', durationMs: 800 },
      {
        runId: failed.id,
        stepIndex: 1,
        stepId: 'send',
        status: 'failed',
        durationMs: 3_000,
        message: 'Element nicht gefunden …',
      },
      { runId: passed.id, stepIndex: 0, stepId: 'open', status: 'passed', durationMs: 700 },
      { runId: passed.id, stepIndex: 1, stepId: 'send', status: 'passed', durationMs: 900 },
    ]);

    const wave = await getWaveReport(db, passed.id);

    expect(wave.job).toEqual({ id: job.id, name: 'Kontaktformular-Test' });
    expect(wave.flow.steps.map((step) => step.id)).toEqual(['open', 'send']);
    expect(wave.manual).toBe(false);
    expect(wave.scheduledAt).toEqual(failed.scheduledAt);
    // In the order they were queued; the run of the next slot is not part of it.
    expect(wave.runs).toEqual([
      {
        id: failed.id,
        runNr: 1,
        botNr: 1,
        device: 'desktop',
        browser: 'chromium',
        status: 'failed',
        scheduledAt: failed.scheduledAt,
        startedAt: failed.startedAt,
        finishedAt: failed.finishedAt,
        error: 'Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).',
        failedStep: { stepIndex: 1, stepId: 'send', message: 'Element nicht gefunden …' },
      },
      {
        id: passed.id,
        runNr: 2,
        botNr: 1,
        device: 'iphone',
        browser: 'chromium',
        status: 'passed',
        scheduledAt: passed.scheduledAt,
        startedAt: passed.startedAt,
        finishedAt: passed.finishedAt,
        error: null,
        failedStep: null,
      },
    ]);
  });

  it('groups manual runs by the moment they were queued together', async () => {
    const { job } = await jobWithRuns();
    const at = (seconds: number) => new Date(Date.UTC(2026, 10, 5, 13, 0, seconds));
    const [a, b, other] = (await db
      .insert(runs)
      .values([
        { jobId: job.id, runNr: 10, slotIndex: null, device: 'desktop', scheduledAt: at(0) },
        { jobId: job.id, runNr: 11, slotIndex: null, device: 'iphone', scheduledAt: at(0) },
        { jobId: job.id, runNr: 12, slotIndex: null, device: 'desktop', scheduledAt: at(30) },
      ])
      .returning()) as [Run, Run, Run];

    const wave = await getWaveReport(db, b.id);
    expect(wave.manual).toBe(true);
    expect(wave.runs.map((run) => run.id)).toEqual([a.id, b.id]);
    expect((await getWaveReport(db, other.id)).runs.map((run) => run.id)).toEqual([other.id]);
  });

  it.each([
    ['an unknown', '00000000-0000-0000-0000-000000000000'],
    ['a malformed', 'welle-7'],
  ])('throws NotFoundError for %s id', async (_case, id) => {
    await expect(getWaveReport(db, id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
