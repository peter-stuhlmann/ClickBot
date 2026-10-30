import { z } from 'zod';
import {
  DEFAULT_TIMEZONE,
  TIME_PATTERN,
  isCalendarDate,
  isTimeZone,
  localToUtc,
} from './local-time';
import { randomScheduleSchema, randomStarts } from './random-schedule';

export { DEFAULT_TIMEZONE, localToUtc } from './local-time';

const BOTS_RANGE = 'Pro Termin 1 bis 50 Bots.';
const EVERY_RANGE = 'Abstand muss zwischen 1 und 10.080 Minuten liegen.';
const MAX_RUNS_RANGE = 'Bitte eine ganze Zahl zwischen 1 und 10.000 eingeben.';

const slotSchema = z.object({
  date: z.string().refine(isCalendarDate, 'Ungültiges Datum (erwartet: JJJJ-MM-TT).'),
  time: z.string().regex(TIME_PATTERN, 'Ungültige Uhrzeit (erwartet: HH:MM).'),
  bots: z.number({ error: BOTS_RANGE }).int(BOTS_RANGE).min(1, BOTS_RANGE).max(50, BOTS_RANGE),
});

const timesScheduleSchema = z
  .object({
    type: z.literal('times'),
    slots: z
      .array(slotSchema)
      .min(1, 'Mindestens einen Termin anlegen.')
      .max(500, 'Höchstens 500 Termine.'),
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
  everyMinutes: z
    .number({ error: EVERY_RANGE })
    .int(EVERY_RANGE)
    .min(1, EVERY_RANGE)
    .max(10_080, EVERY_RANGE),
  maxRuns: z
    .number({ error: MAX_RUNS_RANGE })
    .int(MAX_RUNS_RANGE)
    .min(1, MAX_RUNS_RANGE)
    .max(10_000, MAX_RUNS_RANGE),
  startAt: z.iso.datetime({ offset: true, error: 'Ungültiger Startzeitpunkt.' }),
});

export const scheduleSchema = z.discriminatedUnion('type', [
  intervalScheduleSchema,
  timesScheduleSchema,
  randomScheduleSchema,
]);

export type Schedule = z.infer<typeof scheduleSchema>;
export type ScheduleSlot = z.infer<typeof slotSchema>;

export type BotStart = {
  /** Index of the slot (times) or of the run (interval, random). */
  slotIndex: number;
  /** 1-based number of the bot within its wave; exposed to flows as `{{bot_nr}}`. */
  botNr: number;
  at: Date;
};

/** All bot starts of a schedule, earliest first. Expects a schedule that passed validation. */
export function expandSchedule(schedule: Schedule): BotStart[] {
  const starts: BotStart[] = [];

  if (schedule.type === 'random') {
    return randomStarts(schedule).map((at, slotIndex) => ({ slotIndex, botNr: 1, at }));
  }

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
