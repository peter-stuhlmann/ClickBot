import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';
import {
  CURVE_POINTS,
  curveValue,
  FLAT_CURVE,
  randomScheduleSchema,
  randomStarts,
  weekdaysIn,
} from './random-schedule';
import { expandSchedule, scheduleSchema } from './schedule';

const berlin = (date: Date) => new TZDate(date.getTime(), 'Europe/Berlin');
const curve = (value: (hour: number) => number) =>
  Array.from({ length: CURVE_POINTS }, (_, hour) => value(hour));

/** November 2026: 30 days, starting on a Sunday. */
const november = (overrides: Record<string, unknown> = {}) =>
  randomScheduleSchema.parse({
    type: 'random',
    from: '2026-11-01',
    to: '2026-11-30',
    runs: 100,
    seed: 42,
    ...overrides,
  });

describe('curveValue', () => {
  it('is 1 everywhere for the flat default', () => {
    for (const hour of [0, 3.5, 12, 23.9, 24]) expect(curveValue(FLAT_CURVE, hour)).toBe(1);
  });

  it('passes through every point and runs smoothly between them', () => {
    const points = curve((hour) => (hour === 12 ? 2 : 1));
    expect(curveValue(points, 12)).toBe(2);
    expect(curveValue(points, 11)).toBe(1);
    const between = curveValue(points, 11.5);
    expect(between).toBeGreaterThan(1);
    expect(between).toBeLessThan(2);
  });

  it('never goes below „nie“ or above „hoch“, even where the curve swings', () => {
    const points = curve((hour) => (hour % 2 === 0 ? 0 : 2));
    for (let hour = 0; hour <= 24; hour += 0.1) {
      const value = curveValue(points, hour);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(2);
    }
  });
});

describe('randomScheduleSchema', () => {
  it('fills in flat curves, no kept starts and the German time zone', () => {
    expect(november()).toMatchObject({ curves: {}, kept: [], timezone: 'Europe/Berlin' });
  });

  it.each([
    [{ to: '2026-10-31' }, 'to', 'Das Ende liegt vor dem Start.'],
    [{ to: '2027-11-30' }, 'to', 'Höchstens ein Jahr.'],
    [{ runs: 0 }, 'runs', 'Bitte eine ganze Zahl zwischen 1 und 10.000 eingeben.'],
    [{ from: '2026-02-30' }, 'from', 'Ungültiges Datum (erwartet: JJJJ-MM-TT).'],
    [{ curves: { mon: [1, 2] } }, 'curves.mon', 'Eine Kurve hat 25 Punkte (0 bis 24 Uhr).'],
    [
      {
        curves: Object.fromEntries(
          weekdaysIn('2026-11-01', '2026-11-30').map((d) => [d, curve(() => 0)]),
        ),
      },
      'curves',
      'Die Kurven lassen im Zeitraum keinen Start zu.',
    ],
    [{ drawFrom: '2026-12-01T00:00:00+01:00' }, 'to', 'Der Zeitraum ist schon vorbei.'],
    [
      {
        runs: 2,
        kept: [
          '2026-11-01T10:00:00+01:00',
          '2026-11-02T10:00:00+01:00',
          '2026-11-03T10:00:00+01:00',
        ],
      },
      'runs',
      'Es sind schon 3 Starts gelaufen; mindestens so viele Durchläufe.',
    ],
  ])('refuses %o at %s', (overrides, path, message) => {
    const result = randomScheduleSchema.safeParse({
      type: 'random',
      from: '2026-11-01',
      to: '2026-11-30',
      runs: 100,
      seed: 42,
      ...overrides,
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.map((issue) => [issue.path.join('.'), issue.message]),
    ).toContainEqual([path, message]);
  });

  it('is one of the schedule types', () => {
    expect(scheduleSchema.parse(november()).type).toBe('random');
  });
});

describe('weekdaysIn', () => {
  it('lists the weekdays a period touches, from Monday', () => {
    expect(weekdaysIn('2026-11-06', '2026-11-08')).toEqual(['fri', 'sat', 'sun']);
    expect(weekdaysIn('2026-11-01', '2026-11-30')).toEqual([
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
      'sun',
    ]);
  });
});

describe('randomStarts', () => {
  it('draws as many starts as asked, sorted, on whole minutes, inside the period', () => {
    const starts = randomStarts(november());
    expect(starts).toHaveLength(100);
    expect([...starts].sort((a, b) => a.getTime() - b.getTime())).toEqual(starts);
    for (const start of starts) {
      expect(start.getUTCSeconds()).toBe(0);
      expect(start.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-01T00:00:00+01:00'));
      expect(start.getTime()).toBeLessThan(Date.parse('2026-12-01T00:00:00+01:00'));
    }
  });

  it('draws the same starts for the same plan, and others for another seed', () => {
    expect(randomStarts(november())).toEqual(randomStarts(november()));
    expect(randomStarts(november({ seed: 7 }))).not.toEqual(randomStarts(november()));
  });

  it('starts nothing where the curve is at „nie“, e.g. at night', () => {
    const daytime = curve((hour) => (hour <= 7 || hour >= 20 ? 0 : 1));
    const curves = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, daytime]),
    );
    for (const start of randomStarts(november({ curves, runs: 500 }))) {
      const hour = berlin(start).getHours();
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThan(20);
    }
  });

  it('gives a day with a higher curve more starts: by the area under its curve', () => {
    // Four whole weeks; Mondays twice as often as every other day.
    const schedule = november({
      from: '2026-11-02',
      to: '2026-11-29',
      runs: 2000,
      curves: { mon: curve(() => 2) },
    });
    const mondays = randomStarts(schedule).filter((start) => berlin(start).getDay() === 1);
    // Expected share: 2 / (2 + 6 × 1) = 25 %.
    expect(mondays.length / 2000).toBeGreaterThan(0.22);
    expect(mondays.length / 2000).toBeLessThan(0.28);
  });

  it('draws only from when the plan was made or changed on', () => {
    const drawFrom = '2026-11-15T12:00:00+01:00';
    for (const start of randomStarts(november({ drawFrom }))) {
      expect(start.getTime()).toBeGreaterThanOrEqual(Date.parse(drawFrom));
    }
  });

  it('keeps the starts that already ran in place and draws only the rest anew', () => {
    const kept = ['2026-11-01T09:13:00.000Z', '2026-11-03T15:40:00.000Z'];
    const starts = randomStarts(november({ kept, drawFrom: '2026-11-10T00:00:00+01:00' }));
    expect(starts).toHaveLength(100);
    expect(starts.slice(0, 2).map((start) => start.toISOString())).toEqual(kept);
    expect(starts[2]?.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-11-10T00:00:00+01:00'));
  });

  it('skips the hour the clock change leaves out', () => {
    const starts = randomStarts(november({ from: '2026-03-29', to: '2026-03-29', runs: 1000 }));
    expect(starts).toHaveLength(1000);
    expect(starts.filter((start) => berlin(start).getHours() === 2)).toEqual([]);
  });

  it('plans one bot per start, numbered by its position', () => {
    const starts = expandSchedule(november({ runs: 3 }));
    expect(starts.map((start) => [start.slotIndex, start.botNr])).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });
});
