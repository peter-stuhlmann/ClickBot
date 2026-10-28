import { eq, sql } from 'drizzle-orm';
import type { Database } from './client';
import { createJob } from './jobs';
import { customers, jobs, runSteps, runs } from './schema';

type DemoJob = {
  name: string;
  /** Page of the local demo website (apps/worker/demo-site). */
  path: string;
  steps: unknown[];
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

const fill = (id: string, label: string, value: string) => ({
  id,
  type: 'fill',
  target: { by: 'label', label },
  value,
});
const click = (id: string, name: string) => ({
  id,
  type: 'click',
  target: { by: 'role', role: 'button', name },
});
const seeText = (id: string, text: string) => ({
  id,
  type: 'assert',
  assertion: { kind: 'textVisible', text },
});

// The four jobs of screen "01 Jobs" in Figma. They target the local demo website, never a real
// third-party site: a running worker executes them for real.
const DEMO_JOBS: DemoJob[] = [
  {
    name: 'Kontaktformular-Test',
    path: '/kontakt.html',
    steps: [
      fill('name', 'Name', '{{faker.name}}'),
      fill('mail', 'E-Mail', '{{faker.email}}'),
      click('send', 'Absenden'),
      seeText('thanks', 'Vielen Dank'),
    ],
    everyMinutes: 15,
    maxRuns: 20,
    status: 'active',
    lastRunMinutesAgo: 3,
    results: runsOf(7),
  },
  {
    name: 'Newsletter-Anmeldung',
    path: '/newsletter.html',
    steps: [
      fill('mail', 'E-Mail', '{{faker.email}}'),
      click('subscribe', 'Anmelden'),
      seeText('confirm', 'Bitte bestätige'),
    ],
    everyMinutes: 60,
    maxRuns: 24,
    status: 'active',
    lastRunMinutesAgo: 12,
    results: runsOf(18, { 9: 'failed', 17: 'warning' }),
  },
  {
    name: 'Login & Bestellstatus',
    path: '/login.html',
    steps: [
      fill('user', 'Benutzername', 'demo'),
      fill('password', 'Passwort', 'demo'),
      click('login', 'Anmelden'),
      seeText('orders', 'Bestellstatus'),
    ],
    everyMinutes: 30,
    maxRuns: 48,
    status: 'active',
    lastRunMinutesAgo: 25,
    results: runsOf(31, { 6: 'failed', 14: 'failed', 22: 'failed', 30: 'failed' }),
  },
  {
    name: 'Preis-Check Produktseite',
    path: '/preis.html',
    steps: [
      { id: 'price', type: 'extract', target: { by: 'testId', testId: 'price' }, saveAs: 'preis' },
      seeText('expected', '49,90 €'),
    ],
    everyMinutes: 120,
    maxRuns: 10,
    status: 'finished',
    lastRunMinutesAgo: 120,
    results: runsOf(10),
  },
];

export const DEFAULT_DEMO_SITE_URL = 'http://127.0.0.1:4100';

/**
 * Demo data for local development (`pnpm db:seed`). Writes only into a database without
 * customers and returns false otherwise, so it can never mix with real data.
 */
export async function seedDemoData(
  db: Database,
  now: Date,
  demoSiteUrl = DEFAULT_DEMO_SITE_URL,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Serialise concurrent seeds: the emptiness check and the inserts must not interleave.
    await tx.execute(sql`LOCK TABLE customers IN EXCLUSIVE MODE`);
    const [existing] = await tx.select({ id: customers.id }).from(customers).limit(1);
    if (existing) return false;

    // No user: the first account registers itself at /registrieren and becomes the admin.

    const [customer] = await tx
      .insert(customers)
      .values({ name: 'Beispiel GmbH', slug: 'beispiel' })
      .returning();
    if (!customer) throw new Error('Demo customer could not be created.');

    for (const [index, demo] of DEMO_JOBS.entries()) {
      const intervalMs = demo.everyMinutes * 60_000;
      const lastRunAt = now.getTime() - demo.lastRunMinutesAgo * 60_000;
      const firstRunAt = lastRunAt - (demo.results.length - 1) * intervalMs;

      const startUrl = new URL(demo.path, demoSiteUrl).href;
      const job = await createJob(tx, {
        customerId: customer.id,
        name: demo.name,
        startUrl,
        flow: {
          version: 1,
          steps: [{ id: 'open', type: 'open', url: startUrl }, ...demo.steps],
        },
        schedule: {
          type: 'interval',
          everyMinutes: demo.everyMinutes,
          maxRuns: demo.maxRuns,
          startAt: new Date(firstRunAt).toISOString(),
        },
      });

      const history = await tx
        .insert(runs)
        .values(
          demo.results.map((status, i) => {
            const finishedAt = new Date(firstRunAt + i * intervalMs);
            return {
              jobId: job.id,
              runNr: i + 1,
              // The run of interval start i, so the planner sees it as done and never repeats it.
              slotIndex: i,
              device: 'desktop' as const,
              status,
              scheduledAt: new Date(finishedAt.getTime() - 9_000),
              startedAt: new Date(finishedAt.getTime() - 8_400),
              finishedAt,
              error: status === 'failed' ? 'Element nicht gefunden (Demo-Daten).' : null,
            };
          }),
        )
        .returning({ id: runs.id, status: runs.status, error: runs.error });

      // Step results for the reports: 8 of the 8.4 s, a failed run fails at its last step.
      const flowSteps = job.flow.steps;
      const stepMs = Math.floor(8_000 / flowSteps.length);
      await tx.insert(runSteps).values(
        history.flatMap((run) =>
          flowSteps.map((step, index) => {
            const failed = run.status === 'failed' && index === flowSteps.length - 1;
            return {
              runId: run.id,
              stepIndex: index,
              stepId: step.id,
              status: failed ? ('failed' as const) : ('passed' as const),
              durationMs: stepMs - ((index * 137) % 300),
              message: failed ? run.error : null,
            };
          }),
        ),
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
