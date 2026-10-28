import { TZDate } from '@date-fns/tz';
import { z } from 'zod';

export const DEFAULT_TIMEZONE = 'Europe/Berlin';

const DAY_MS = 86_400_000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a wall-clock time in `timeZone` to an instant.
 * Returns null if that time does not exist (spring clock change). For a time that exists twice
 * (autumn clock change) the first occurrence wins.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date | null {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes);

  // Offset (local minus UTC) in effect at an instant. getTimezoneOffset() has the opposite sign.
  const offsetAt = (instant: number) => -new TZDate(instant, timeZone).getTimezoneOffset() * 60_000;

  // A clock change switches between at most two offsets, so the ones a day before and after
  // cover every way this wall-clock time can map to an instant, whatever the size of the shift.
  const offsets = new Set([-DAY_MS, 0, DAY_MS].map((delta) => offsetAt(wallClockAsUtc + delta)));
  const matches = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((instant) => {
      const local = new TZDate(instant, timeZone);
      return (
        local.getFullYear() === year &&
        local.getMonth() === month - 1 &&
        local.getDate() === day &&
        local.getHours() === hours &&
        local.getMinutes() === minutes
      );
    });

  return matches.length === 0 ? null : new Date(Math.min(...matches));
}

const slotSchema = z.object({
  date: z.string().refine(isCalendarDate, 'Ungültiges Datum (erwartet: JJJJ-MM-TT).'),
  time: z.string().regex(TIME_PATTERN, 'Ungültige Uhrzeit (erwartet: HH:MM).'),
  bots: z.number().int().min(1).max(50),
});

const timesScheduleSchema = z
  .object({
    type: z.literal('times'),
    slots: z.array(slotSchema).min(1).max(500),
    staggerSeconds: z.number().int().min(0).max(600).default(5),
    timezone: z.string().refine(isTimeZone, 'Unbekannte Zeitzone.').default(DEFAULT_TIMEZONE),
  })
  .superRefine((schedule, ctx) => {
    const seen = new Set<string>();
    schedule.slots.forEach((slot, index) => {
      const key = `${slot.date} ${slot.time}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slots', index],
          message: `Doppelter Termin: ${key}`,
        });
      }
      seen.add(key);

      // The field checks above have already reported broken input; checking the clock change
      // on top would only add a misleading second message.
      const checkable =
        isCalendarDate(slot.date) && TIME_PATTERN.test(slot.time) && isTimeZone(schedule.timezone);
      if (checkable && localToUtc(slot.date, slot.time, schedule.timezone) === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['slots', index, 'time'],
          message: `Diese Uhrzeit gibt es am ${slot.date} wegen der Zeitumstellung nicht.`,
        });
      }
    });
  });

const intervalScheduleSchema = z.object({
  type: z.literal('interval'),
  everyMinutes: z.number().int().min(1).max(10_080),
  maxRuns: z.number().int().min(1).max(10_000),
  startAt: z.iso.datetime({ offset: true }),
});

export const scheduleSchema = z.discriminatedUnion('type', [
  intervalScheduleSchema,
  timesScheduleSchema,
]);

export type Schedule = z.infer<typeof scheduleSchema>;
export type ScheduleSlot = z.infer<typeof slotSchema>;

export type BotStart = {
  /** Index of the slot (times) or of the run (interval). */
  slotIndex: number;
  /** 1-based number of the bot within its wave; exposed to flows as `{{bot_nr}}`. */
  botNr: number;
  at: Date;
};

/** All bot starts of a schedule, earliest first. Expects a schedule that passed validation. */
export function expandSchedule(schedule: Schedule): BotStart[] {
  const starts: BotStart[] = [];

  if (schedule.type === 'interval') {
    const first = new Date(schedule.startAt).getTime();
    for (let run = 0; run < schedule.maxRuns; run++) {
      starts.push({
        slotIndex: run,
        botNr: 1,
        at: new Date(first + run * schedule.everyMinutes * 60_000),
      });
    }
    return starts;
  }

  schedule.slots.forEach((slot, slotIndex) => {
    const waveStart = localToUtc(slot.date, slot.time, schedule.timezone);
    if (!waveStart) throw new Error(`Slot ${slotIndex} has no valid start; validate first.`);
    for (let bot = 0; bot < slot.bots; bot++) {
      starts.push({
        slotIndex,
        botNr: bot + 1,
        at: new Date(waveStart.getTime() + bot * schedule.staggerSeconds * 1000),
      });
    }
  });

  return starts.sort(
    (a, b) => a.at.getTime() - b.at.getTime() || a.slotIndex - b.slotIndex || a.botNr - b.botNr,
  );
}

export function upcomingStarts(starts: readonly BotStart[], now: Date): BotStart[] {
  return starts.filter((start) => start.at.getTime() >= now.getTime());
}
