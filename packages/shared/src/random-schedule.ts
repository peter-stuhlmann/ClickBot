import { z } from 'zod';
import { DEFAULT_TIMEZONE, isCalendarDate, isTimeZone, localToUtc } from './local-time';

/**
 * Random schedule ("Zufall"): `runs` starts spread over the days from `from` to `to`. Per weekday
 * a curve over the day weights the hours: 0 never, 1 normal, 2 twice as often. A day gets starts
 * by the area under its curve. The starts are drawn with a fixed seed, so the same plan always
 * gives the same starts and the planner can expand it again and again.
 */

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** One point per full hour, 0 to 24 o'clock. */
export const CURVE_POINTS = 25;
export const CURVE_MAX = 2;
export const FLAT_CURVE: readonly number[] = Array.from({ length: CURVE_POINTS }, () => 1);

const MAX_DAYS = 366;
const CELL_MINUTES = 10;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const RUNS_RANGE = 'Bitte eine ganze Zahl zwischen 1 und 10.000 eingeben.';

const curveSchema = z
  .array(z.number().min(0).max(CURVE_MAX), { error: 'Eine Kurve hat 25 Punkte (0 bis 24 Uhr).' })
  .length(CURVE_POINTS, 'Eine Kurve hat 25 Punkte (0 bis 24 Uhr).');

const instant = () => z.iso.datetime({ offset: true, error: 'Ungültiger Zeitpunkt.' });

/**
 * The value of a curve at `hour` (0–24): a Catmull-Rom spline through the points, so dragging
 * one point keeps the curve smooth. Clamped to 0 („nie“) and CURVE_MAX („hoch“).
 */
export function curveValue(points: readonly number[], hour: number): number {
  const h = Math.min(24, Math.max(0, hour));
  const i = Math.min(CURVE_POINTS - 2, Math.floor(h));
  const t = h - i;
  const p = (k: number) => points[Math.min(CURVE_POINTS - 1, Math.max(0, k))] ?? 1;
  const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
  const value =
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  return Math.min(CURVE_MAX, Math.max(0, value));
}

const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The calendar days from `from` to `to`, both included. */
function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = utcDay(from); day <= utcDay(to); day += DAY_MS) days.push(isoDay(day));
  return days;
}

function weekdayOf(date: string): Weekday {
  return WEEKDAYS[(new Date(utcDay(date)).getUTCDay() + 6) % 7] as Weekday;
}

/** The weekdays a period touches, from Monday on: the curves that matter for it. */
export function weekdaysIn(from: string, to: string): Weekday[] {
  if (!isCalendarDate(from) || !isCalendarDate(to) || utcDay(to) < utcDay(from)) return [];
  const touched = new Set(daysOf(from, to).slice(0, 7).map(weekdayOf));
  return WEEKDAYS.filter((day) => touched.has(day));
}

type Cell = { start: number; weight: number };

type Plan = {
  from: string;
  to: string;
  curves: Partial<Record<Weekday, number[]>>;
  timezone: string;
  drawFrom?: string;
};

/** Ten-minute cells of the period from `drawFrom` on, each weighted by the curve of its day. */
function cellsOf(plan: Plan): Cell[] {
  const notBefore = plan.drawFrom ? Date.parse(plan.drawFrom) : Number.NEGATIVE_INFINITY;
  const cells: Cell[] = [];
  for (const day of daysOf(plan.from, plan.to)) {
    const points = plan.curves[weekdayOf(day)] ?? FLAT_CURVE;
    for (let hour = 0; hour < 24; hour++) {
      // An hour the clock change leaves out has no start.
      const hourStart = localToUtc(day, `${String(hour).padStart(2, '0')}:00`, plan.timezone);
      if (!hourStart) continue;
      for (let minute = 0; minute < 60; minute += CELL_MINUTES) {
        const start = hourStart.getTime() + minute * MINUTE_MS;
        if (start < notBefore) continue;
        const weight = curveValue(points, hour + (minute + CELL_MINUTES / 2) / 60);
        if (weight > 0) cells.push({ start, weight });
      }
    }
  }
  return cells;
}

/** Small, fast and seedable: the same seed always gives the same numbers. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const randomScheduleSchema = z
  .object({
    type: z.literal('random'),
    from: z.string().refine(isCalendarDate, 'Ungültiges Datum (erwartet: JJJJ-MM-TT).'),
    to: z.string().refine(isCalendarDate, 'Ungültiges Datum (erwartet: JJJJ-MM-TT).'),
    runs: z
      .number({ error: RUNS_RANGE })
      .int(RUNS_RANGE)
      .min(1, RUNS_RANGE)
      .max(10_000, RUNS_RANGE),
    /** Weekdays without a curve of their own run evenly (FLAT_CURVE). */
    curves: z.partialRecord(z.enum(WEEKDAYS), curveSchema).default({}),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2 ** 31 - 1),
    /** Starts are drawn from this instant on: when the plan was made or last changed. */
    drawFrom: instant().optional(),
    /** Starts that ran before the last change; they keep the first positions as they are. */
    kept: z.array(instant()).max(10_000).default([]),
    timezone: z.string().refine(isTimeZone, 'Unbekannte Zeitzone.').default(DEFAULT_TIMEZONE),
  })
  .superRefine((plan, ctx) => {
    if (!isCalendarDate(plan.from) || !isCalendarDate(plan.to) || !isTimeZone(plan.timezone)) {
      return;
    }
    const days = (utcDay(plan.to) - utcDay(plan.from)) / DAY_MS + 1;
    if (days < 1) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Das Ende liegt vor dem Start.' });
      return;
    }
    if (days > MAX_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Höchstens ein Jahr.' });
      return;
    }
    if (plan.kept.length > plan.runs) {
      ctx.addIssue({
        code: 'custom',
        path: ['runs'],
        message: `Es sind schon ${plan.kept.length} Starts gelaufen; mindestens so viele Läufe.`,
      });
      return;
    }
    if (plan.kept.length === plan.runs) return;
    const end = localToUtc(isoDay(utcDay(plan.to) + DAY_MS), '00:00', plan.timezone);
    if (plan.drawFrom && end && Date.parse(plan.drawFrom) >= end.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Der Zeitraum ist schon vorbei.' });
      return;
    }
    if (cellsOf(plan).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['curves'],
        message: 'Die Kurven lassen im Zeitraum keinen Start zu.',
      });
    }
  });

export type RandomSchedule = z.infer<typeof randomScheduleSchema>;

// The planner expands active plans every second; drawing a year of cells each time is wasteful.
const drawn = new Map<string, Date[]>();
const MAX_CACHED = 100;

/**
 * The starts of a valid random plan, earliest first: the kept ones, then `runs` minus those,
 * drawn by the weights of the cells and placed on a whole minute inside their cell.
 */
export function randomStarts(plan: RandomSchedule): Date[] {
  const key = JSON.stringify(plan);
  const cached = drawn.get(key);
  if (cached) return cached.map((date) => new Date(date));

  const kept = plan.kept.map((at) => new Date(at)).sort((a, b) => a.getTime() - b.getTime());
  const cells = cellsOf(plan);
  const cumulative: number[] = [];
  let total = 0;
  for (const cell of cells) {
    total += cell.weight;
    cumulative.push(total);
  }
  const random = mulberry32(plan.seed);
  const fresh: Date[] = [];
  for (let i = kept.length; i < plan.runs && total > 0; i++) {
    const target = random() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((cumulative[middle] as number) <= target) low = middle + 1;
      else high = middle;
    }
    const cell = cells[low] as Cell;
    fresh.push(new Date(cell.start + Math.floor(random() * CELL_MINUTES) * MINUTE_MS));
  }
  fresh.sort((a, b) => a.getTime() - b.getTime());

  const starts = [...kept, ...fresh];
  if (drawn.size >= MAX_CACHED) drawn.delete(drawn.keys().next().value as string);
  drawn.set(key, starts);
  return starts.map((date) => new Date(date));
}
