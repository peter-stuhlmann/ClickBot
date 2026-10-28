import type { Schedule } from '@click-bot/shared';

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
  if (schedule.type === 'interval') {
    const { everyMinutes } = schedule;
    const primary =
      everyMinutes >= 120 && everyMinutes % 60 === 0
        ? `alle ${everyMinutes / 60} Std.`
        : `alle ${everyMinutes} Min.`;
    return { primary, secondary: `max. ${plural(schedule.maxRuns, 'Lauf', 'Läufe')}` };
  }
  const bots = schedule.slots.reduce((sum, slot) => sum + slot.bots, 0);
  return {
    primary: plural(schedule.slots.length, 'Termin', 'Termine'),
    secondary: plural(bots, 'Bot', 'Bots'),
  };
}
