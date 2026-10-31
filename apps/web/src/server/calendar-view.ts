import 'server-only';
import type { CalendarJob } from '@click-bot/db';
import { addDays, todayIn } from '@/lib/calendar';
import type { CalendarDayView, LoadView, WeekNavView } from '@/lib/views';
import {
  dayEntries,
  dayLabel,
  dayLoad,
  describeBusy,
  describeSuggestion,
  overloads,
  suggestMove,
  wavesOf,
  weekBounds,
  weekTitle,
  type Busy,
} from '@/lib/week-plan';

/**
 * How many browsers the worker runs at once: as it reported, else as configured for it
 * (MAX_CONCURRENT_BROWSERS, the same `.env`), else its default of 6.
 */
export function browserLimit(reported: number | null, configured: string | undefined): number {
  const fromEnv = Number(configured);
  return reported ?? (Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : 6);
}

const href = (monday: string, day?: string) =>
  `/kalender?woche=${monday}${day ? `&tag=${day}` : ''}`;

/**
 * Screen 13: the week of the current project, and the load of one day. The load counts the jobs
 * of every project, because they share the browsers of the worker.
 */
export function toCalendarView(
  jobs: readonly CalendarJob[],
  options: {
    monday: string;
    /** The day whose load is shown; without one (or outside the week) a fitting day. */
    selected: string | undefined;
    now: Date;
    limit: number;
    project: string | null;
  },
): { title: string; days: CalendarDayView[]; load: LoadView; nav: WeekNavView } {
  const { monday, now, limit, project } = options;
  const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const waves = wavesOf(jobs, weekBounds(monday));
  const busy = overloads(waves, limit);
  const ours = waves.filter((wave) => wave.customerId === project);
  const today = todayIn(now);

  const firstBusy = dates.find((date) => dayLoad(waves, busy, date).busy.length > 0);
  const selected =
    (options.selected && dates.includes(options.selected) ? options.selected : undefined) ??
    firstBusy ??
    (dates.includes(today) ? today : monday);

  const days = dates.map((date) => ({
    date,
    label: dayLabel(date),
    href: href(monday, date),
    selected: date === selected,
    today: date === today,
    entries: dayEntries(ours, date, busy).map(({ jobId, ...entry }) => ({
      ...entry,
      key: `${jobId}-${entry.time}`,
      href: `/jobs/${jobId}`,
    })),
  }));

  return {
    title: weekTitle(monday),
    days,
    load: toLoadView(waves, busy, selected, { now, limit, project }),
    nav: {
      previousHref: href(addDays(monday, -7)),
      currentHref: '/kalender',
      nextHref: href(addDays(monday, 7)),
    },
  };
}

function toLoadView(
  waves: ReturnType<typeof wavesOf>,
  busy: Busy[],
  date: string,
  { now, limit, project }: { now: Date; limit: number; project: string | null },
): LoadView {
  const load = dayLoad(waves, busy, date);
  return {
    title: `Auslastung ${dayLabel(date, 'long')}`,
    overloads: load.busy.map((stretch) => {
      const move = project ? suggestMove(waves, stretch, limit, { now, project }) : null;
      return {
        key: stretch.start.toISOString(),
        ...describeBusy(stretch, limit, project ?? ''),
        suggestion: move && {
          ...describeSuggestion(move, limit),
          fields: {
            jobId: move.jobId,
            slotIndex: String(move.slotIndex),
            fromDate: move.from.date,
            fromTime: move.from.time,
            toDate: move.to.date,
            toTime: move.to.time,
          },
        },
      };
    }),
    summary:
      load.busy.length > 0
        ? null
        : load.peak === 0
          ? 'An diesem Tag läuft nichts.'
          : `Keine Engpässe: höchstens ${load.peak} von ${limit} Browsern gleichzeitig belegt.`,
    note: `Das Testsystem hat ${limit} Browser, die sich alle Projekte teilen. Wie lange ein Durchlauf einen Browser belegt, schätzt der Kalender aus den Durchläufen der letzten 30 Tage; für Tests ohne Durchläufe nimmt er eine Minute an.`,
  };
}
