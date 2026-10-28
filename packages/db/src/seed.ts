import { eq, sql } from 'drizzle-orm';
import type { Database } from './client';
import { createJob } from './jobs';
import { customers, jobs, runs, users } from './schema';

type DemoJob = {
  name: string;
  startUrl: string;
  everyMinutes: number;
  maxRuns: number;
  status: 'active' | 'finished';
  /** Minutes before `now` the last run finished. */
  lastRunMinutesAgo: number;
  /** One entry per finished run, oldest first. */
  results: ('passed' | 'warning' | 'failed')[];
};

const runsOf = (count: number, exceptions: Record<number, 'warning' | 'failed'> = {}) =>
  Array.from({ length: count }, (_, i) => exceptions[i] ?? 'passed');

// The four jobs of screen "01 Jobs" in Figma.
const DEMO_JOBS: DemoJob[] = [
  {
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de/kontakt',
    everyMinutes: 15,
    maxRuns: 20,
    status: 'active',
    lastRunMinutesAgo: 3,
    results: runsOf(7),
  },
  {
    name: 'Newsletter-Anmeldung',
    startUrl: 'https://shop.beispiel.de/newsletter',
    everyMinutes: 60,
    maxRuns: 24,
    status: 'active',
    lastRunMinutesAgo: 12,
    results: runsOf(18, { 9: 'failed', 17: 'warning' }),
  },
  {
    name: 'Login & Bestellstatus',
    startUrl: 'https://portal.beispiel.de/login',
    everyMinutes: 30,
    maxRuns: 48,
    status: 'active',
    lastRunMinutesAgo: 25,
    results: runsOf(31, { 6: 'failed', 14: 'failed', 22: 'failed', 30: 'failed' }),
  },
  {
    name: 'Preis-Check Produktseite',
    startUrl: 'https://preise.beispiel.de/p/4711',
    everyMinutes: 120,
    maxRuns: 10,
    status: 'finished',
    lastRunMinutesAgo: 120,
    results: runsOf(10),
  },
];

/**
 * Demo data for local development (`pnpm db:seed`). Writes only into a database without
 * customers and returns false otherwise, so it can never mix with real data.
 */
export async function seedDemoData(db: Database, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Serialise concurrent seeds: the emptiness check and the inserts must not interleave.
    await tx.execute(sql`LOCK TABLE customers IN EXCLUSIVE MODE`);
    const [existing] = await tx.select({ id: customers.id }).from(customers).limit(1);
    if (existing) return false;

    await tx.insert(users).values({
      email: 'admin@click-bot.local',
      name: 'Peter Stuhlmann',
      // Login does not exist yet; this hash matches no password.
      passwordHash: '!demo-no-login',
      role: 'admin',
    });

    const [customer] = await tx
      .insert(customers)
      .values({ name: 'Beispiel GmbH', slug: 'beispiel' })
      .returning();
    if (!customer) throw new Error('Demo customer could not be created.');

    for (const [index, demo] of DEMO_JOBS.entries()) {
      const intervalMs = demo.everyMinutes * 60_000;
      const lastRunAt = now.getTime() - demo.lastRunMinutesAgo * 60_000;
      const firstRunAt = lastRunAt - (demo.results.length - 1) * intervalMs;

      const job = await createJob(tx, {
        customerId: customer.id,
        name: demo.name,
        startUrl: demo.startUrl,
        flow: {
          version: 1,
          steps: [
            { id: 'open', type: 'open', url: demo.startUrl },
            { id: 'check', type: 'assert', assertion: { kind: 'urlContains', value: '/' } },
          ],
        },
        schedule: {
          type: 'interval',
          everyMinutes: demo.everyMinutes,
          maxRuns: demo.maxRuns,
          startAt: new Date(firstRunAt).toISOString(),
        },
      });

      await tx.insert(runs).values(
        demo.results.map((status, i) => {
          const finishedAt = new Date(firstRunAt + i * intervalMs);
          return {
            jobId: job.id,
            runNr: i + 1,
            device: 'desktop' as const,
            status,
            scheduledAt: new Date(finishedAt.getTime() - 9_000),
            startedAt: new Date(finishedAt.getTime() - 8_400),
            finishedAt,
            error: status === 'failed' ? 'Element nicht gefunden (Demo-Daten).' : null,
          };
        }),
      );
      // All jobs share the transaction's timestamp; stagger them to keep the design's order.
      const createdAt = new Date(now.getTime() - 30 * 86_400_000 + index * 60_000);
      await tx
        .update(jobs)
        .set({ status: demo.status, runCounter: demo.results.length, createdAt })
        .where(eq(jobs.id, job.id));
    }
    return true;
  });
}
