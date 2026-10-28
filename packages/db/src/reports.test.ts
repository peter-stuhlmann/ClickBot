import { ne } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { NotFoundError } from './errors';
import { createJob } from './jobs';
import type { Run } from './queue';
import { getRunReport } from './reports';
import { runSteps, runs } from './schema';

const flow = {
  version: 1,
  steps: [
    { id: 'open', type: 'open', url: '/kontakt' },
    { id: 'send', type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
  ],
};

async function jobWithRuns() {
  const customer = await insertCustomer();
  const job = await createJob(db, {
    customerId: customer.id,
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
      },
      {
        stepIndex: 1,
        stepId: 'send',
        status: 'failed',
        durationMs: 3_000,
        message: 'Element nicht gefunden …',
        screenshotPath: `runs/${failed.id}/1-send.png`,
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

  it.each([
    ['an unknown', '00000000-0000-0000-0000-000000000000'],
    ['a malformed', 'lauf-7'],
  ])('throws NotFoundError for %s id', async (_case, id) => {
    await expect(getRunReport(db, id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
