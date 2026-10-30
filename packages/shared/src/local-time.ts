import { TZDate } from '@date-fns/tz';

export const DEFAULT_TIMEZONE = 'Europe/Berlin';

const DAY_MS = 86_400_000;

export const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isTimeZone(value: string): boolean {
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
