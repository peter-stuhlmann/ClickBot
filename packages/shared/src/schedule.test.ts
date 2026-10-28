import { describe, expect, it } from 'vitest';
import { expandSchedule, localToUtc, scheduleSchema, upcomingStarts } from './schedule';

const times = (slots: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'times',
  slots,
  ...extra,
});

describe('localToUtc', () => {
  it('converts Berlin winter time (UTC+1)', () => {
    expect(localToUtc('2026-11-05', '13:24', 'Europe/Berlin')?.toISOString()).toBe(
      '2026-11-05T12:24:00.000Z',
    );
  });

  it('converts Berlin summer time (UTC+2)', () => {
    expect(localToUtc('2026-07-01', '13:24', 'Europe/Berlin')?.toISOString()).toBe(
      '2026-07-01T11:24:00.000Z',
    );
  });

  it('returns null for a time skipped by the spring clock change', () => {
    expect(localToUtc('2026-03-29', '02:30', 'Europe/Berlin')).toBeNull();
  });

  it('uses the first occurrence for a time repeated by the autumn clock change', () => {
    expect(localToUtc('2026-10-25', '02:30', 'Europe/Berlin')?.toISOString()).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });

  it('handles other time zones', () => {
    expect(localToUtc('2026-11-05', '09:00', 'America/New_York')?.toISOString()).toBe(
      '2026-11-05T14:00:00.000Z',
    );
  });

  it('handles a time just after midnight next to a clock change', () => {
    expect(localToUtc('2026-10-25', '00:15', 'Europe/Berlin')?.toISOString()).toBe(
      '2026-10-24T22:15:00.000Z',
    );
  });

  // Lord Howe Island shifts its clocks by 30 minutes, not by a full hour.
  it('uses the first occurrence for a time repeated by a 30-minute clock change', () => {
    expect(localToUtc('2026-04-05', '01:45', 'Australia/Lord_Howe')?.toISOString()).toBe(
      '2026-04-04T14:45:00.000Z',
    );
  });

  it('returns null for a time skipped by a 30-minute clock change', () => {
    expect(localToUtc('2026-10-04', '02:15', 'Australia/Lord_Howe')).toBeNull();
  });
});

describe('scheduleSchema', () => {
  it('defaults to Berlin time and a 5 s stagger', () => {
    const schedule = scheduleSchema.parse(times([{ date: '2026-11-05', time: '13:24', bots: 3 }]));
    expect(schedule).toMatchObject({ timezone: 'Europe/Berlin', staggerSeconds: 5 });
  });

  it.each([
    ['2026-02-30', '13:00'],
    ['2026-13-01', '13:00'],
    ['05.11.2026', '13:00'],
    ['2026-11-05', '24:00'],
    ['2026-11-05', '13:60'],
    ['2026-11-05', '1:30'],
  ])('rejects invalid date/time %s %s', (date, time) => {
    expect(scheduleSchema.safeParse(times([{ date, time, bots: 1 }])).success).toBe(false);
  });

  it('reports only the broken field, without follow-up errors about the clock change', () => {
    const result = scheduleSchema.safeParse(
      times([{ date: '2026-02-30', time: '13:24', bots: 1 }]),
    );
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['slots', 0, 'date']]);

    const badTime = scheduleSchema.safeParse(
      times([{ date: '2026-11-05', time: '25:00', bots: 1 }]),
    );
    expect(badTime.error?.issues.map((issue) => issue.path)).toEqual([['slots', 0, 'time']]);
  });

  it.each([0, 51, 1.5])('rejects %s bots per slot', (bots) => {
    const slot = { date: '2026-11-05', time: '13:24', bots };
    expect(scheduleSchema.safeParse(times([slot])).success).toBe(false);
  });

  it('rejects a schedule without slots', () => {
    expect(scheduleSchema.safeParse(times([])).success).toBe(false);
  });

  it('reports a duplicate slot at its position', () => {
    const slot = { date: '2026-11-05', time: '13:24', bots: 3 };
    const result = scheduleSchema.safeParse(times([slot, { ...slot, bots: 1 }]));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['slots', 1]);
    expect(result.error?.issues[0]?.message).toBe('Doppelter Termin: 2026-11-05 13:24');
  });

  it('rejects a slot in the spring clock-change gap with a readable message', () => {
    const result = scheduleSchema.safeParse(
      times([{ date: '2026-03-29', time: '02:30', bots: 1 }]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['slots', 0, 'time']);
    expect(result.error?.issues[0]?.message).toBe(
      'Diese Uhrzeit gibt es am 2026-03-29 wegen der Zeitumstellung nicht.',
    );
  });

  it('rejects an unknown time zone', () => {
    const slot = { date: '2026-11-05', time: '13:24', bots: 1 };
    const result = scheduleSchema.safeParse(times([slot], { timezone: 'Europe/Atlantis' }));
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['timezone']]);
  });

  it('accepts an interval schedule and rejects a start time without offset', () => {
    const interval = {
      type: 'interval',
      everyMinutes: 15,
      maxRuns: 20,
      startAt: '2026-10-28T14:30:00+01:00',
    };
    expect(scheduleSchema.safeParse(interval).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...interval, startAt: '2026-10-28T14:30:00' }).success).toBe(
      false,
    );
    expect(scheduleSchema.safeParse({ ...interval, everyMinutes: 0 }).success).toBe(false);
  });
});

describe('expandSchedule', () => {
  it('starts the bots of one slot as a wave, staggered by the configured seconds', () => {
    const schedule = scheduleSchema.parse(
      times([{ date: '2026-11-05', time: '13:38', bots: 3 }], { staggerSeconds: 10 }),
    );
    expect(expandSchedule(schedule).map((s) => [s.slotIndex, s.botNr, s.at.toISOString()])).toEqual(
      [
        [0, 1, '2026-11-05T12:38:00.000Z'],
        [0, 2, '2026-11-05T12:38:10.000Z'],
        [0, 3, '2026-11-05T12:38:20.000Z'],
      ],
    );
  });

  it('starts all bots at once when stagger is 0', () => {
    const schedule = scheduleSchema.parse(
      times([{ date: '2026-11-05', time: '13:38', bots: 2 }], { staggerSeconds: 0 }),
    );
    const [a, b] = expandSchedule(schedule);
    expect(a?.at.getTime()).toBe(b?.at.getTime());
  });

  it('sorts starts chronologically even when slots are entered out of order', () => {
    const schedule = scheduleSchema.parse(
      times([
        { date: '2026-11-06', time: '14:00', bots: 1 },
        { date: '2026-11-05', time: '13:24', bots: 1 },
      ]),
    );
    expect(expandSchedule(schedule).map((s) => s.slotIndex)).toEqual([1, 0]);
  });

  it('expands the example from the planning: 3 at 13:24, 6 at 13:38, 1 at 14:00', () => {
    const schedule = scheduleSchema.parse(
      times([
        { date: '2026-11-05', time: '13:24', bots: 3 },
        { date: '2026-11-05', time: '13:38', bots: 6 },
        { date: '2026-11-06', time: '14:00', bots: 1 },
      ]),
    );
    const starts = expandSchedule(schedule);
    expect(starts).toHaveLength(10);
    expect(starts.filter((s) => s.slotIndex === 1).map((s) => s.botNr)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('expands an interval schedule into maxRuns single-bot starts', () => {
    const schedule = scheduleSchema.parse({
      type: 'interval',
      everyMinutes: 15,
      maxRuns: 3,
      startAt: '2026-10-28T14:30:00+01:00',
    });
    expect(expandSchedule(schedule).map((s) => [s.slotIndex, s.botNr, s.at.toISOString()])).toEqual(
      [
        [0, 1, '2026-10-28T13:30:00.000Z'],
        [1, 1, '2026-10-28T13:45:00.000Z'],
        [2, 1, '2026-10-28T14:00:00.000Z'],
      ],
    );
  });
});

describe('expandSchedule with an unvalidated schedule', () => {
  it('refuses a slot whose time does not exist instead of guessing a start', () => {
    const unvalidated = {
      type: 'times' as const,
      slots: [{ date: '2026-03-29', time: '02:30', bots: 1 }],
      staggerSeconds: 5,
      timezone: 'Europe/Berlin',
    };
    expect(() => expandSchedule(unvalidated)).toThrow('Slot 0 has no valid start');
  });
});

describe('upcomingStarts', () => {
  it('keeps starts at or after now and drops past ones', () => {
    const schedule = scheduleSchema.parse(
      times([{ date: '2026-11-05', time: '13:38', bots: 3 }], { staggerSeconds: 10 }),
    );
    const now = new Date('2026-11-05T12:38:10.000Z');
    expect(upcomingStarts(expandSchedule(schedule), now).map((s) => s.botNr)).toEqual([2, 3]);
  });
});

describe('messages for the schedule form', () => {
  const messages = (input: unknown) =>
    Object.fromEntries(
      (scheduleSchema.safeParse(input).error?.issues ?? []).map((issue) => [
        issue.path.join('.'),
        issue.message,
      ]),
    );

  it('names the allowed range of an interval in German', () => {
    expect(
      messages({ type: 'interval', everyMinutes: 0, maxRuns: Number.NaN, startAt: 'bald' }),
    ).toEqual({
      everyMinutes: 'Abstand muss zwischen 1 und 10.080 Minuten liegen.',
      maxRuns: 'Bitte eine ganze Zahl zwischen 1 und 10.000 eingeben.',
      startAt: 'Ungültiger Startzeitpunkt.',
    });
  });

  it('names the allowed number of bots per slot and asks for a first slot', () => {
    expect(messages(times([{ date: '2026-11-05', time: '13:24', bots: 51 }]))).toEqual({
      'slots.0.bots': 'Pro Termin 1 bis 50 Bots.',
    });
    expect(messages(times([]))).toEqual({ slots: 'Mindestens einen Termin anlegen.' });
  });
});
