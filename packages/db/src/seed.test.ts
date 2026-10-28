import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { listJobOverview } from './overview';
import { planDueRuns } from './queue';
import { customers, jobs as jobsTable, runSteps, runs } from './schema';
import { seedDemoData } from './seed';

const now = new Date('2026-11-05T12:30:00Z');

describe('seedDemoData', () => {
  it('fills an empty database with the four jobs from the design', async () => {
    expect(await seedDemoData(db, now)).toBe(true);

    const overview = await listJobOverview(db);
    expect(
      overview.map((row) => [
        row.name,
        row.status,
        row.runsDone,
        row.runsPlanned,
        row.lastRun?.status,
      ]),
    ).toEqual([
      ['Kontaktformular-Test', 'active', 7, 20, 'passed'],
      ['Newsletter-Anmeldung', 'active', 18, 24, 'warning'],
      ['Login & Bestellstatus', 'active', 31, 48, 'failed'],
      ['Preis-Check Produktseite', 'finished', 10, 10, 'passed'],
    ]);
  });

  it('dates the last runs relative to now, like in the design', async () => {
    await seedDemoData(db, now);
    const minutesAgo = (await listJobOverview(db)).map((row) =>
      Math.round((now.getTime() - (row.lastRun?.finishedAt.getTime() ?? 0)) / 60_000),
    );
    expect(minutesAgo).toEqual([3, 12, 25, 120]);
  });

  it('produces realistic success rates', async () => {
    await seedDemoData(db, now);
    const rates = (await listJobOverview(db)).map((row) =>
      Math.round((row.successRate ?? 0) * 100),
    );
    expect(rates).toEqual([100, 94, 87, 100]);
  });

  it('points every demo job at the local demo website, never at a real third-party site', async () => {
    await seedDemoData(db, now);
    const urls = (await listJobOverview(db)).map((row) => new URL(row.startUrl));
    expect(urls.map((url) => url.host)).toEqual([
      '127.0.0.1:4100',
      '127.0.0.1:4100',
      '127.0.0.1:4100',
      '127.0.0.1:4100',
    ]);
    const jobs = await db.select().from(jobsTable);
    for (const job of jobs) {
      const openSteps = job.flow.steps.filter((step) => step.type === 'open');
      expect(openSteps.every((step) => step.url.startsWith('http://127.0.0.1:4100/'))).toBe(true);
    }
  });

  it('can use another address for the demo website', async () => {
    await seedDemoData(db, now, 'http://127.0.0.1:4200');
    const [row] = await listJobOverview(db);
    expect(row?.startUrl).toBe('http://127.0.0.1:4200/kontakt.html');
  });

  it('records the demo history as done, so the planner does not repeat a start', async () => {
    await seedDemoData(db, now);
    const before = (await db.select().from(runs)).length;

    expect(await planDueRuns(db, { now })).toEqual({ created: 0, finishedJobs: 0 });
    expect(await db.select().from(runs)).toHaveLength(before);
  });

  it('gives every demo run step results, so its report has something to show', async () => {
    await seedDemoData(db, now);
    const [failed] = await db.select().from(runs).where(eq(runs.status, 'failed')).limit(1);
    const steps = await db
      .select()
      .from(runSteps)
      .where(eq(runSteps.runId, failed?.id as string))
      .orderBy(runSteps.stepIndex);

    expect(steps.length).toBeGreaterThan(1);
    expect(steps.slice(0, -1).every((step) => step.status === 'passed')).toBe(true);
    expect(steps.at(-1)).toMatchObject({ status: 'failed', message: failed?.error });
    // The steps fit into the run's duration.
    const total = steps.reduce((sum, step) => sum + step.durationMs, 0);
    expect(total).toBeLessThanOrEqual(
      (failed?.finishedAt?.getTime() ?? 0) - (failed?.startedAt?.getTime() ?? 0),
    );
  });

  it('never touches a database that already has data', async () => {
    await insertCustomer('Echter Kunde', 'echt');
    expect(await seedDemoData(db, now)).toBe(false);
    expect(await db.select().from(customers)).toHaveLength(1);
  });
});
