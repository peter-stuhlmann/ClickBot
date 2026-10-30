import { DEFAULT_TIMEZONE } from '@click-bot/shared';

/**
 * Calendar days as ISO strings ("2026-11-20"), the form date fields store. All arithmetic runs in
 * UTC, so no time zone or daylight saving time moves a day.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const GERMAN = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/;
const DAY_MS = 86_400_000;

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

function toUtc(iso: string): Date {
  const [, year, month, day] = ISO.exec(iso) as RegExpExecArray;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function fromUtc(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The ISO day, or null if year, month and day are no real date (31.11., 29.02.2027). */
function isoOf(year: number, month: number, day: number): string | null {
  const iso = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return month >= 1 && month <= 12 && day >= 1 && fromUtc(toUtc(iso)) === iso ? iso : null;
}

/** "20.11.2026", "1.2.27" or "2026-11-20" → "2026-11-20"; null for anything else. */
export function parseGermanDate(text: string): string | null {
  const trimmed = text.trim();
  const iso = ISO.exec(trimmed);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const german = GERMAN.exec(trimmed);
  if (!german) return null;
  const year = german[3] as string;
  return isoOf(
    year.length === 2 ? 2000 + Number(year) : Number(year),
    Number(german[2]),
    Number(german[1]),
  );
}

/** "2026-03-05" → "05.03.2026"; anything else stays as it is. */
export function formatGermanDate(value: string): string {
  const iso = ISO.exec(value);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : value;
}

/** A real day in the stored form. */
export function isIsoDate(value: string): boolean {
  return ISO.test(value) && parseGermanDate(value) === value;
}

export function addDays(iso: string, days: number): string {
  return fromUtc(new Date(toUtc(iso).getTime() + days * DAY_MS));
}

/** Same day in another month; the 31st becomes the last day of a shorter month. */
export function addMonths(iso: string, months: number): string {
  const date = toUtc(iso);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return fromUtc(target);
}

/** Monday of the week. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -((toUtc(iso).getUTCDay() + 6) % 7));
}

/** Sunday of the week. */
export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

/** Six weeks from the Monday before the 1st: the same height for every month. */
export function monthGrid(iso: string): string[][] {
  const first = startOfWeek(`${iso.slice(0, 7)}-01`);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)),
  );
}

const monthFormat = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const berlinDay = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIMEZONE });

/** "November 2026". */
export function monthLabel(iso: string): string {
  return monthFormat.format(toUtc(iso));
}

/** "Freitag, 20. November 2026", for screen readers. */
export function describeDay(iso: string): string {
  return dayFormat.format(toUtc(iso));
}

/** Today in German time, where all schedules live. */
export function todayIn(now: Date): string {
  return berlinDay.format(now);
}

/** The earliest day the end of a period may have: its start, once that is a day. */
export function earliestEnd(start: string): string | undefined {
  return isIsoDate(start) ? start : undefined;
}

/** The end once a new start is chosen: one before the start no longer fits and is cleared. */
export function endAfterNewStart(start: string, end: string): string {
  return isIsoDate(end) && end < start ? '' : end;
}
