import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
import { NotFoundError, ValidationError } from './errors';
import { createJob, getJob, listStartedSlots, updateJob, type JobUpdateInput } from './jobs';
import { runs } from './schema';

const flow = {
  version: 1,
  steps: [{ id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' }],
};

const times = (slots: { date: string; time: string; bots: number }[]) => ({
  type: 'times',
  slots,
  staggerSeconds: 10,
});

const slotA = { date: '2026-11-05', time: '13:24', bots: 3 };
const slotB = { date: '2026-11-05', time: '13:38', bots: 1 };

async function newJob(schedule: unknown = times([slotA, slotB])) {
  const { campaignId } = await insertCampaign();
  const job = await createJob(db, {
    campaignId,
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de/kontakt',
    flow,
    schedule,
    status: 'active',
  });
  return job;
}

function update(job: { id: string }, overrides: Partial<JobUpdateInput> = {}) {
  return updateJob(db, job.id, {
    name: 'Kontaktformular-Test',
    startUrl: 'https://beispiel.de/kontakt',
    flow,
    schedule: times([slotA, slotB]),
    devices: ['desktop'],
    ...overrides,
  });
}

async function runOfSlot(jobId: string, slotIndex: number | null, runNr: number, botNr = 1) {
  await db.insert(runs).values({
    jobId,
    runNr,
    slotIndex,
    botNr,
    device: 'desktop',
    status: 'passed',
    scheduledAt: new Date('2026-11-05T12:24:00Z'),
  });
}

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

describe('updateJob', () => {
  it('stores name, address, flow, schedule and devices, and keeps the status', async () => {
    const job = await newJob();
    const updated = await update(job, {
      name: '  Kontakt neu ',
      startUrl: 'https://beispiel.de/kontakt-neu',
      flow: {
        version: 1,
        steps: [
          ...flow.steps,
          { id: 'thanks', type: 'assert', assertion: { kind: 'textVisible', text: 'Danke' } },
        ],
      },
      schedule: times([{ ...slotA, bots: 5 }]),
      devices: ['iphone', 'desktop', 'iphone'],
    });

    expect(updated).toMatchObject({
      name: 'Kontakt neu',
      startUrl: 'https://beispiel.de/kontakt-neu',
      devices: ['iphone', 'desktop'],
      status: 'active',
    });
    expect(updated.flow.steps.map((step) => step.id)).toEqual(['open', 'thanks']);
    expect(updated.schedule).toMatchObject({ slots: [{ ...slotA, bots: 5 }] });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(job.updatedAt.getTime());
  });

  it('stores the browsers per device, and keeps them when the input leaves them out', async () => {
    const job = await newJob();
    const changed = await update(job, { deviceBrowsers: { desktop: ['firefox', 'chromium'] } });
    expect(changed.deviceBrowsers).toEqual({ desktop: ['chromium', 'firefox'] });

    const kept = await update(changed, { name: 'Ohne Browser-Angabe' });
    expect(kept.deviceBrowsers).toEqual({ desktop: ['chromium', 'firefox'] });

    // A device added without browsers starts in its default one.
    const more = await update(kept, { devices: ['desktop', 'android'] });
    expect(more.deviceBrowsers).toEqual({
      desktop: ['chromium', 'firefox'],
      android: ['chromium'],
    });
  });

  it('reports every problem with its path and changes nothing', async () => {
    const job = await newJob();
    const issues = await issuesOf(
      update(job, {
        name: ' ',
        startUrl: 'beispiel.de',
        flow: { version: 1, steps: [] },
        devices: [],
      }),
    );
    expect(issues.map((issue) => issue.path)).toEqual([
      'name',
      'startUrl',
      'devices',
      'flow.steps',
    ]);
    expect((await getJob(db, job.id)).name).toBe('Kontaktformular-Test');
  });

  it.each([
    ['an unknown', '00000000-0000-0000-0000-000000000000'],
    ['a malformed', 'job-7'],
  ])('throws NotFoundError for %s job', async (_case, id) => {
    await expect(update({ id })).rejects.toBeInstanceOf(NotFoundError);
  });

  describe('dates that already have runs', () => {
    it('cannot be moved or removed, because the planner knows them by position', async () => {
      const job = await newJob();
      await runOfSlot(job.id, 0, 1);

      const moved = await issuesOf(
        update(job, { schedule: times([{ ...slotA, time: '13:30' }, slotB]) }),
      );
      expect(moved).toEqual([
        {
          path: 'schedule.slots.0',
          message:
            'Dieser Termin hat schon Läufe und lässt sich nicht mehr verschieben oder löschen.',
        },
      ]);

      const removed = await issuesOf(update(job, { schedule: times([slotB]) }));
      expect(removed.map((issue) => issue.path)).toEqual(['schedule.slots.0']);
    });

    it('can get more or fewer bots, and new dates can follow them', async () => {
      const job = await newJob();
      await runOfSlot(job.id, 0, 1);
      const later = { date: '2026-11-06', time: '14:00', bots: 1 };

      const updated = await update(job, {
        schedule: times([{ ...slotA, bots: 6 }, { ...slotB, time: '13:40' }, later]),
      });

      expect(updated.schedule).toMatchObject({ slots: [{ bots: 6 }, { time: '13:40' }, later] });
    });

    it('keep the kind of schedule fixed', async () => {
      const job = await newJob();
      await runOfSlot(job.id, 1, 1);
      const issues = await issuesOf(
        update(job, {
          schedule: {
            type: 'interval',
            everyMinutes: 15,
            maxRuns: 4,
            startAt: '2026-11-05T12:00:00Z',
          },
        }),
      );
      expect(issues).toEqual([
        {
          path: 'schedule.type',
          message:
            'Die Art des Zeitplans lässt sich nicht mehr ändern, weil der Job schon Läufe hat.',
        },
      ]);
    });

    it('do not restrict an interval, which simply continues with the next run', async () => {
      const job = await newJob({
        type: 'interval',
        everyMinutes: 15,
        maxRuns: 10,
        startAt: '2026-11-05T12:00:00Z',
      });
      await runOfSlot(job.id, 0, 1);
      const updated = await update(job, {
        schedule: {
          type: 'interval',
          everyMinutes: 30,
          maxRuns: 5,
          startAt: '2026-11-05T13:00:00Z',
        },
      });
      expect(updated.schedule).toMatchObject({ everyMinutes: 30, maxRuns: 5 });
    });

    it('ignore manual test runs, which belong to no date', async () => {
      const job = await newJob();
      await runOfSlot(job.id, null, 1);
      await expect(update(job, { schedule: times([slotB]) })).resolves.toBeDefined();
    });
  });
});

describe('listStartedSlots', () => {
  it('lists the dates that already have runs, once each and in order', async () => {
    const job = await newJob();
    await runOfSlot(job.id, 1, 1);
    await runOfSlot(job.id, 0, 2);
    await runOfSlot(job.id, 1, 3, 2);
    await runOfSlot(job.id, null, 4);
    expect(await listStartedSlots(db, job.id)).toEqual([0, 1]);
  });
});

describe('getJob', () => {
  it('treats a malformed id as not found', async () => {
    await expect(getJob(db, 'job-7')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('updateJob and the GA4 marking', () => {
  it('switches markings off and on again', async () => {
    const job = await newJob();
    const off = await update(job, {
      analyticsMarking: { debugMode: false, internalTraffic: false },
    });
    expect(off.analyticsMarking).toMatchObject({
      debugMode: false,
      internalTraffic: false,
      botFlag: true,
    });

    const on = await update(job, { analyticsMarking: {} });
    expect(on.analyticsMarking).toMatchObject({ debugMode: true, internalTraffic: true });
  });

  it('keeps the marking when the update does not mention it', async () => {
    const job = await newJob();
    await update(job, { analyticsMarking: { botFlag: false } });
    const later = await update(job, { name: 'Kontakt neu' });
    expect(later.analyticsMarking.botFlag).toBe(false);
  });
});
