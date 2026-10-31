import { formatGermanDate } from './calendar';
import { DEFAULT_TIMEZONE, type Schedule } from '@click-bot/shared';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "1 Lauf" / "3 Läufe". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('de-DE')} ${count === 1 ? singular : pluralForm}`;
}

/** 0.952 → "95,2 %". */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

/** "vor 3 Min.", "vor 2 Std.", "vor 5 Tagen", "in 14 Min.". */
export function formatRelative(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return `in ${Math.max(1, Math.round(-diff / MINUTE))} Min.`;
  if (diff < MINUTE) return 'gerade eben';
  if (diff < HOUR) return `vor ${Math.floor(diff / MINUTE)} Min.`;
  if (diff < DAY) return `vor ${Math.floor(diff / HOUR)} Std.`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}

/** "https://beispiel.de/kontakt" → "beispiel.de/kontakt". */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`.replace(/^\/$/, '');
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
}

/** Two lines for the schedule column, e.g. "alle 15 Min." / "max. 20 Läufe". */
export function describeSchedule(schedule: Schedule): { primary: string; secondary: string } {
  if (schedule.type === 'random') {
    return {
      primary: `zufällig ${formatGermanDate(schedule.from)}–${formatGermanDate(schedule.to)}`,
      secondary: plural(schedule.runs, 'Durchlauf', 'Durchläufe'),
    };
  }
  if (schedule.type === 'interval') {
    const { everyMinutes, maxRuns } = schedule;
    if (maxRuns === 1) return { primary: 'einmal', secondary: 'ein Durchlauf' };
    const primary =
      everyMinutes === 60
        ? 'jede Stunde'
        : everyMinutes === 1440
          ? 'jeden Tag'
          : everyMinutes >= 120 && everyMinutes % 60 === 0
            ? `alle ${everyMinutes / 60} Std.`
            : `alle ${everyMinutes} Min.`;
    return { primary, secondary: `${maxRuns}-mal` };
  }
  const bots = schedule.slots.reduce((sum, slot) => sum + slot.bots, 0);
  return {
    primary: plural(schedule.slots.length, 'Termin', 'Termine'),
    secondary: plural(bots, 'Browser', 'Browser'),
  };
}

/** 34 → "34 ms", 8400 → "8,4 s", from one minute on "1:04 min". */
export function formatDuration(ms: number): string {
  // Local steps often take a few milliseconds; "0,0 s" would hide that they ran at all.
  if (ms < 100) return `${Math.round(ms)} ms`;
  if (ms < MINUTE) {
    const seconds = (ms / 1000).toLocaleString('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${seconds} s`;
  }
  const totalSeconds = Math.round(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${Math.floor(totalSeconds / 60)}:${seconds} min`;
}

const clock = new Intl.DateTimeFormat('de-DE', {
  timeZone: DEFAULT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const longDate = new Intl.DateTimeFormat('de-DE', {
  timeZone: DEFAULT_TIMEZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** "14:30:12" in German time. */
export function formatClock(date: Date): string {
  return clock.format(date);
}

/** "Do., 05.11.2026" in German time. */
export function formatDateLong(date: Date): string {
  return longDate.format(date);
}

const shortDateTime = new Intl.DateTimeFormat('de-DE', {
  timeZone: DEFAULT_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "05.11. 14:30" in German time. */
export function formatShortDateTime(date: Date): string {
  return shortDateTime.format(date).replace(',', '');
}
