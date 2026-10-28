import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { listJobOverview } from './overview';
import { customers } from './schema';
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

  it('never touches a database that already has data', async () => {
    await insertCustomer('Echter Kunde', 'echt');
    expect(await seedDemoData(db, now)).toBe(false);
    expect(await db.select().from(customers)).toHaveLength(1);
  });
});
