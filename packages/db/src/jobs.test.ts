import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer, single } from '../test/db';
import { NotFoundError, ValidationError } from './errors';
import { allocateRunNumber, createJob, getJob } from './jobs';
import { customers, jobs, runSteps, runs } from './schema';

const validFlow = {
  version: 1,
  steps: [
    { id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' },
    { id: 'send', type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
  ],
};

const validSchedule = {
  type: 'times',
  slots: [{ date: '2026-11-05', time: '13:24', bots: 3 }],
};

async function newJob(overrides: Record<string, unknown> = {}) {
  const customer = await insertCustomer();
  return createJob(db, {
    customerId: customer.id,
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de/kontakt',
    flow: validFlow,
    schedule: validSchedule,
    ...overrides,
  });
}

function issuePaths(error: unknown): string[] {
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues.map((issue) => issue.path);
}

describe('createJob', () => {
  it('stores flow and schedule with the defaults filled in, as a draft on desktop', async () => {
    const job = await newJob();

    expect(job).toMatchObject({ status: 'draft', devices: ['desktop'], runCounter: 0 });
    expect(job.flow.steps[1]).toMatchObject({ timeoutMs: 10_000, aiFallback: true });
    expect(job.schedule).toMatchObject({ timezone: 'Europe/Berlin', staggerSeconds: 5 });
  });

  it('reports flow and schedule problems together, with paths to the fields', async () => {
    const error = await newJob({
      flow: { version: 1, steps: [validFlow.steps[0], validFlow.steps[0]] },
      schedule: { type: 'times', slots: [{ date: '2026-02-30', time: '13:24', bots: 1 }] },
    }).catch((e: unknown) => e);

    expect(issuePaths(error)).toEqual(['flow.steps.1.id', 'schedule.slots.0.date']);
  });

  it.each([
    ['name', { name: '   ' }],
    ['startUrl', { startUrl: 'beispiel.de' }],
    ['startUrl', { startUrl: 'ftp://beispiel.de' }],
    ['devices', { devices: [] }],
  ])('rejects an invalid %s', async (field, overrides) => {
    const error = await newJob(overrides).catch((e: unknown) => e);
    expect(issuePaths(error)).toEqual([field]);
  });

  it('writes nothing when validation fails', async () => {
    await newJob({ name: '' }).catch(() => undefined);
    expect(await db.select().from(jobs)).toHaveLength(0);
  });

  it('stores several devices without duplicates', async () => {
    const job = await newJob({ devices: ['desktop', 'iphone', 'desktop'] });
    expect(job.devices).toEqual(['desktop', 'iphone']);
  });

  it('fails for an unknown customer', async () => {
    await expect(
      createJob(db, {
        customerId: '00000000-0000-0000-0000-000000000000',
        name: 'Test',
        startUrl: 'https://beispiel.de',
        flow: validFlow,
        schedule: validSchedule,
      }),
    ).rejects.toThrow();
  });
});

describe('getJob', () => {
  it('returns the stored job', async () => {
    const job = await newJob();
    expect((await getJob(db, job.id)).name).toBe('Kontaktformular-Test');
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(getJob(db, '00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('allocateRunNumber', () => {
  it('counts up from 1', async () => {
    const job = await newJob();
    expect(await allocateRunNumber(db, job.id)).toBe(1);
    expect(await allocateRunNumber(db, job.id)).toBe(2);
  });

  it('hands out unique numbers when a whole wave asks at the same time', async () => {
    const job = await newJob();
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => allocateRunNumber(db, job.id)),
    );
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('keeps separate counters per job', async () => {
    const first = await newJob();
    const second = await createJob(db, {
      customerId: first.customerId,
      name: 'Newsletter',
      startUrl: 'https://beispiel.de/newsletter',
      flow: validFlow,
      schedule: validSchedule,
    });
    await allocateRunNumber(db, first.id);
    expect(await allocateRunNumber(db, second.id)).toBe(1);
  });

  it('throws NotFoundError for an unknown job', async () => {
    await expect(
      allocateRunNumber(db, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleting', () => {
  it('does not delete a customer that still has jobs', async () => {
    const job = await newJob();
    await expect(db.delete(customers).where(eq(customers.id, job.customerId))).rejects.toThrow();
  });

  it('removes runs and their steps together with the job', async () => {
    const job = await newJob();
    const run = single(
      await db
        .insert(runs)
        .values({ jobId: job.id, runNr: 1, device: 'desktop', scheduledAt: new Date() })
        .returning(),
    );
    await db.insert(runSteps).values({
      runId: run.id,
      stepIndex: 0,
      stepId: 'open',
      status: 'passed',
      durationMs: 800,
    });

    await db.delete(jobs).where(eq(jobs.id, job.id));

    expect(await db.select().from(runs)).toHaveLength(0);
    expect(await db.select().from(runSteps)).toHaveLength(0);
  });
});
