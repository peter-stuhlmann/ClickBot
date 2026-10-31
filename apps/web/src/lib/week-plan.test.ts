import type { Schedule } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import {
  dayEntries,
  dayLabel,
  dayLoad,
  describeBusy,
  describeSuggestion,
  isoWeek,
  overloads,
  suggestMove,
  wavesOf,
  weekBounds,
  weekOf,
  weekTitle,
  type PlanJob,
} from './week-plan';

const MIN = 60_000;
const PROJECT = 'projekt-1';

/** The item at a position; fails the test clearly if there is none. */
function nth<T>(items: readonly T[], index = 0): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Nothing at ${index} of ${items.length}`);
  return item;
}

function job(id: string, schedule: Schedule, overrides: Partial<PlanJob> = {}): PlanJob {
  return {
    id,
    name: id,
    customerId: PROJECT,
    customerName: 'Beispiel GmbH',
    schedule,
    devices: ['desktop'],
    deviceBrowsers: { desktop: ['chromium'] },
    typicalRunMs: MIN,
    ...overrides,
  };
}

const times = (
  slots: { date: string; time: string; bots: number }[],
  staggerSeconds = 0,
): Schedule => ({ type: 'times', slots, staggerSeconds, timezone: 'Europe/Berlin' });

const hourly = (startAt: string, maxRuns: number): Schedule => ({
  type: 'interval',
  everyMinutes: 60,
  maxRuns,
  startAt,
});

// Week 45 of 2026: Monday 2 November to Sunday 8 November.
const MONDAY = '2026-11-02';
const week = weekBounds(MONDAY);
const now = new Date('2026-11-04T08:00:00Z');

describe('weeks', () => {
  it('goes to the Monday of any day, and to this week for anything else', () => {
    expect(weekOf('2026-11-05', '2026-10-31')).toBe('2026-11-02');
    expect(weekOf('2026-11-02', '2026-10-31')).toBe('2026-11-02');
    expect(weekOf('2026-02-30', '2026-10-31')).toBe('2026-10-26');
    expect(weekOf(undefined, '2026-10-31')).toBe('2026-10-26');
  });

  it('counts calendar weeks like ISO 8601, across the turn of the year', () => {
    expect(isoWeek('2026-11-02')).toBe(45);
    expect(isoWeek('2026-12-28')).toBe(53);
    expect(isoWeek('2025-12-29')).toBe(1);
    expect(isoWeek('2027-01-04')).toBe(1);
  });

  it('names the week with its days, the month and year only where they change', () => {
    expect(weekTitle('2026-11-02')).toBe('KW 45 · 02.–08.11.2026');
    expect(weekTitle('2026-10-26')).toBe('KW 44 · 26.10.–01.11.2026');
    expect(weekTitle('2026-12-28')).toBe('KW 53 · 28.12.2026–03.01.2027');
  });

  it('names days short and long', () => {
    expect(dayLabel('2026-11-05')).toBe('Do 05.11.');
    expect(dayLabel('2026-11-05', 'long')).toBe('Do, 05.11.');
  });

  it('runs from Monday midnight to the next Monday in German time', () => {
    expect(week.start.toISOString()).toBe('2026-11-01T23:00:00.000Z');
    expect(week.end.toISOString()).toBe('2026-11-08T23:00:00.000Z');
  });
});

describe('wavesOf', () => {
  it('makes a wave of each date: its bots on every device and browser', () => {
    const [wave] = wavesOf(
      [
        job('kontakt', times([{ date: '2026-11-05', time: '13:24', bots: 3 }], 10), {
          devices: ['desktop', 'iphone'],
          deviceBrowsers: { desktop: ['chromium', 'firefox'], iphone: ['webkit'] },
        }),
      ],
      week,
    );
    expect(wave).toMatchObject({
      jobId: 'kontakt',
      slotIndex: 0,
      slot: { date: '2026-11-05', time: '13:24' },
      runs: 9,
    });
    expect(wave?.at.toISOString()).toBe('2026-11-05T12:24:00.000Z');
    // The last bot starts 20 s later and runs its typical minute.
    expect(wave?.end.toISOString()).toBe('2026-11-05T12:25:20.000Z');
  });

  it('assumes a minute for jobs that never ran, and keeps only waves of the week', () => {
    const waves = wavesOf(
      [job('neu', hourly('2026-11-08T22:00:00Z', 3), { typicalRunMs: null })],
      week,
    );
    expect(waves.map((wave) => wave.at.toISOString())).toEqual(['2026-11-08T22:00:00.000Z']);
    expect(nth(waves).end.getTime() - nth(waves).at.getTime()).toBe(MIN);
    expect(nth(waves).slot).toBeNull();
  });
});

describe('dayEntries', () => {
  it('lists the waves of a day by time, with the number of runs', () => {
    const waves = wavesOf(
      [
        job('Login', times([{ date: '2026-11-03', time: '14:00', bots: 2 }])),
        job('Preis-Check', times([{ date: '2026-11-03', time: '09:00', bots: 1 }])),
      ],
      week,
    );
    expect(dayEntries(waves, '2026-11-03', [])).toEqual([
      { jobId: 'Preis-Check', time: '09:00', name: 'Preis-Check', runs: 1, over: false },
      { jobId: 'Login', time: '14:00', name: 'Login', runs: 2, over: false },
    ]);
    expect(dayEntries(waves, '2026-11-04', [])).toEqual([]);
  });

  it('sums up a job that starts many times a day in one entry', () => {
    const waves = wavesOf([job('Preis-Check', hourly('2026-11-02T23:00:00Z', 48))], week);
    expect(dayEntries(waves, '2026-11-03', [])).toEqual([
      { jobId: 'Preis-Check', time: '00:00–23:00', name: 'Preis-Check', runs: 24, over: false },
    ]);
  });
});

describe('overloads', () => {
  const twoWaves = (bots: number) =>
    wavesOf(
      [
        job('Kontakt', times([{ date: '2026-11-05', time: '13:38', bots }])),
        job('Newsletter', times([{ date: '2026-11-05', time: '13:38', bots }])),
      ],
      week,
    );

  it('finds the moments with more runs than browsers', () => {
    const [busy, ...rest] = overloads(twoWaves(6), 6);
    expect(rest).toEqual([]);
    expect(busy?.start.toISOString()).toBe('2026-11-05T12:38:00.000Z');
    expect(busy?.peak).toBe(12);
    expect(busy?.waves.map((wave) => wave.jobId)).toEqual(['Kontakt', 'Newsletter']);
  });

  it('is fine as long as every run gets a browser', () => {
    expect(overloads(twoWaves(3), 6)).toEqual([]);
  });

  it('counts how long runs take: a long run still holds its browser later', () => {
    const plan = (typicalRunMs: number) =>
      wavesOf(
        [
          job('Lang', times([{ date: '2026-11-05', time: '13:00', bots: 6 }]), { typicalRunMs }),
          job('Später', times([{ date: '2026-11-05', time: '13:05', bots: 1 }])),
        ],
        week,
      );
    expect(overloads(plan(10 * MIN), 6)).toHaveLength(1);
    // A browser that frees up at the moment another run starts is enough.
    expect(overloads(plan(5 * MIN), 6)).toEqual([]);
  });

  it('marks the entries of the waves that wait', () => {
    const waves = twoWaves(6);
    const entries = dayEntries(waves, '2026-11-05', overloads(waves, 6));
    expect(entries.map((entry) => entry.over)).toEqual([true, true]);
  });
});

describe('dayLoad', () => {
  it('tells the busiest moment of a day and its overloads', () => {
    const waves = wavesOf(
      [
        job('Kontakt', times([{ date: '2026-11-05', time: '13:38', bots: 4 }])),
        job('Newsletter', times([{ date: '2026-11-05', time: '13:38', bots: 4 }])),
        job('Login', times([{ date: '2026-11-03', time: '09:00', bots: 2 }])),
      ],
      week,
    );
    const busy = overloads(waves, 6);
    expect(dayLoad(waves, busy, '2026-11-05')).toMatchObject({ peak: 8, busy: [busy[0]] });
    expect(dayLoad(waves, busy, '2026-11-03')).toEqual({ peak: 2, busy: [] });
    expect(dayLoad(waves, busy, '2026-11-04')).toEqual({ peak: 0, busy: [] });
  });
});

describe('suggestMove', () => {
  const plan = (newsletter: Schedule, kontakt = hourly('2026-11-05T12:38:00Z', 1)) =>
    wavesOf([job('Kontakt', kontakt), job('Newsletter', newsletter)], week);
  const newsletterAt = (...slots: string[]) =>
    times(slots.map((time) => ({ date: '2026-11-05', time, bots: 6 })));

  it('moves the wave of a plan by dates to the first minute in which everything fits', () => {
    const waves = plan(
      newsletterAt('13:38'),
      times([{ date: '2026-11-05', time: '13:38', bots: 6 }]),
    );
    const busy = nth(overloads(waves, 6));
    expect(suggestMove(waves, busy, 6, { now, project: PROJECT })).toEqual({
      jobId: 'Newsletter',
      jobName: 'Newsletter',
      slotIndex: 0,
      from: { date: '2026-11-05', time: '13:38' },
      to: { date: '2026-11-05', time: '13:39' },
      peak: 6,
    });
  });

  it('only moves dates, and only of the current project', () => {
    const interval = wavesOf(
      [
        job('Kontakt', hourly('2026-11-05T12:38:00Z', 1)),
        job('Newsletter', hourly('2026-11-05T12:38:00Z', 1), {
          deviceBrowsers: { desktop: ['chromium', 'firefox', 'webkit'] },
          devices: ['desktop'],
        }),
      ],
      week,
    );
    expect(overloads(interval, 3)).toHaveLength(1);
    expect(suggestMove(interval, nth(overloads(interval, 3)), 3, { now, project: PROJECT })).toBe(
      null,
    );

    const waves = plan(newsletterAt('13:38'));
    const busy = nth(overloads(waves, 6));
    expect(suggestMove(waves, busy, 6, { now, project: 'anderes' })).toBe(null);
  });

  it('leaves dates alone that start within the next minutes', () => {
    const waves = plan(newsletterAt('13:38'));
    const busy = nth(overloads(waves, 6));
    const soon = new Date('2026-11-05T12:36:00Z');
    expect(suggestMove(waves, busy, 6, { now: soon, project: PROJECT })).toBe(null);
  });

  it('skips a time the job already has', () => {
    const waves = plan(newsletterAt('13:38', '13:39'));
    const busy = nth(overloads(waves, 6));
    expect(suggestMove(waves, busy, 6, { now, project: PROJECT })?.to.time).toBe('13:40');
  });

  it('gives up when nothing fits within two hours', () => {
    const waves = plan(newsletterAt('13:38'), {
      type: 'interval',
      everyMinutes: 1,
      maxRuns: 400,
      startAt: '2026-11-05T12:00:00Z',
    });
    const busy = nth(overloads(waves, 6));
    expect(suggestMove(waves, busy, 6, { now, project: PROJECT })).toBe(null);
  });
});

describe('texts', () => {
  const waves = wavesOf(
    [
      job('Kontaktformular', times([{ date: '2026-11-05', time: '13:38', bots: 6 }])),
      job('Newsletter', times([{ date: '2026-11-05', time: '13:38', bots: 6 }]), {
        customerId: 'projekt-2',
        customerName: 'Müller Shop',
      }),
      job('Allein', times([{ date: '2026-11-06', time: '10:00', bots: 8 }])),
    ],
    week,
  );
  const together = nth(overloads(waves, 6), 0);
  const alone = nth(overloads(waves, 6), 1);

  it('explains an overload, naming jobs of other projects with their project', () => {
    expect(describeBusy(together, 6, PROJECT)).toEqual({
      title: '13:38 Uhr: 12 Durchläufe für 6 Browser',
      text: '„Kontaktformular“ (6 Durchläufe) und „Newsletter“ (Müller Shop, 6 Durchläufe) laufen gleichzeitig. 6 Durchläufe warten in der Warteschlange und starten später als geplant.',
    });
    expect(describeBusy(alone, 6, PROJECT)).toEqual({
      title: '10:00 Uhr: 8 Durchläufe für 6 Browser',
      text: '„Allein“ (8 Durchläufe) startet mehr Durchläufe, als Browser frei sind. 2 Durchläufe warten in der Warteschlange und starten später als geplant.',
    });
  });

  it('words a suggestion, with the day if it changes', () => {
    const move = {
      jobId: 'Newsletter',
      jobName: 'Newsletter',
      slotIndex: 0,
      from: { date: '2026-11-05', time: '13:38' },
      to: { date: '2026-11-05', time: '13:45' },
      peak: 6,
    };
    expect(describeSuggestion(move, 6)).toEqual({
      title: 'Vorschlag: „Newsletter“ auf 13:45 verschieben',
      text: 'Dann laufen höchstens 6 von 6 Browsern gleichzeitig, und alle Durchläufe starten pünktlich.',
    });
    expect(
      describeSuggestion({ ...move, to: { date: '2026-11-06', time: '00:05' }, peak: 4 }, 6).title,
    ).toBe('Vorschlag: „Newsletter“ auf Fr, 06.11. 00:05 verschieben');
  });
});
