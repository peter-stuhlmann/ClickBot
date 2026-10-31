import {
  DEFAULT_TIMEZONE,
  expandSchedule,
  localToUtc,
  runTargets,
  type DeviceBrowsers,
  type DeviceKind,
  type Schedule,
} from '@click-bot/shared';
import { addDays, isIsoDate, startOfWeek } from './calendar';

/**
 * The calendar (screen 13): the starts of a week as waves, and whether the browsers of the
 * worker suffice for them. A run holds a browser from its start for as long as its job's runs
 * typically take; more runs at once than browsers means some wait in the queue and start late.
 */

/** Assumed length of a run of a job that has not run yet. */
export const DEFAULT_RUN_MS = 60_000;
/** From this many starts on one day, a job gets one entry for the day instead of one per start. */
const SUMMARY_FROM = 5;
/** How far a suggestion moves a date at most, in minutes. */
const SUGGEST_WITHIN = 120;
/** Dates that start sooner are left alone: the planner may have queued them already. */
const SETTLE_MS = 5 * 60_000;
/** Around an overload, the waves that a moved date could run into. */
const NEARBY_MS = 6 * 3_600_000;
const MIN = 60_000;

/** A job as the calendar needs it (CalendarJob from @click-bot/db). */
export type PlanJob = {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  schedule: Schedule;
  devices: DeviceKind[];
  deviceBrowsers: DeviceBrowsers;
  typicalRunMs: number | null;
};

/** The runs of one start of a job: a date's bots on every device and browser, or one start. */
export type Wave = {
  jobId: string;
  jobName: string;
  customerId: string;
  customerName: string;
  slotIndex: number;
  /** The date of a plan by dates, which can be moved; null for interval and random starts. */
  slot: { date: string; time: string; timezone: string } | null;
  at: Date;
  /** When the last of its runs typically ends. */
  end: Date;
  runs: number;
  /** Start and end of each run, in ms. */
  spans: [number, number][];
};

/** A stretch of time with more runs than browsers. */
export type Busy = { start: Date; end: Date; peak: number; waves: Wave[] };

export type DayEntry = { jobId: string; time: string; name: string; runs: number; over: boolean };

export type SlotSuggestion = {
  jobId: string;
  jobName: string;
  slotIndex: number;
  from: { date: string; time: string };
  to: { date: string; time: string };
  /** The most browsers in use at once around the date after the move. */
  peak: number;
};

const formats = new Map<string, Intl.DateTimeFormat>();

/** Date ("2026-11-05") and time ("13:38") of an instant in a time zone. */
function local(instant: Date | number, timeZone = DEFAULT_TIMEZONE) {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formats.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

const midnight = (date: string) => localToUtc(date, '00:00', DEFAULT_TIMEZONE) as Date;

/** The Monday of the week of a day; this week for a missing or broken day. */
export function weekOf(value: string | undefined, today: string): string {
  return startOfWeek(value && isIsoDate(value) ? value : today);
}

/** From Monday midnight to the next Monday, German time. */
export function weekBounds(monday: string): { start: Date; end: Date } {
  return { start: midnight(monday), end: midnight(addDays(monday, 7)) };
}

const utcDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Calendar week after ISO 8601: the week with the year's first Thursday is week 1. */
export function isoWeek(monday: string): number {
  const thursday = addDays(monday, 3);
  const dayOfYear = (utcDay(thursday) - Date.UTC(+thursday.slice(0, 4), 0, 1)) / 86_400_000;
  return Math.floor(dayOfYear / 7) + 1;
}

const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** "KW 45 · 02.–08.11.2026"; month and year appear where they change. */
export function weekTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const year = (iso: string) => iso.slice(0, 4);
  const from =
    year(monday) !== year(sunday)
      ? `${dm(monday)}${year(monday)}`
      : monday.slice(5, 7) !== sunday.slice(5, 7)
        ? dm(monday)
        : `${monday.slice(8, 10)}.`;
  return `KW ${isoWeek(monday)} · ${from}–${dm(sunday)}${year(sunday)}`;
}

const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** "Do 05.11.", or in a sentence "Do, 05.11.". */
export function dayLabel(date: string, form: 'short' | 'long' = 'short'): string {
  const weekday = WEEKDAY[new Date(utcDay(date)).getUTCDay()] as string;
  return `${weekday}${form === 'long' ? ',' : ''} ${dm(date)}`;
}

/** The waves that run during the week, earliest first, of every job given. */
export function wavesOf(jobs: readonly PlanJob[], week: { start: Date; end: Date }): Wave[] {
  const waves: Wave[] = [];
  for (const job of jobs) {
    const duration = job.typicalRunMs ?? DEFAULT_RUN_MS;
    const targets = runTargets(job.devices, job.deviceBrowsers).length;
    const bySlot = new Map<number, number[]>();
    for (const start of expandSchedule(job.schedule)) {
      const starts = bySlot.get(start.slotIndex) ?? [];
      starts.push(start.at.getTime());
      bySlot.set(start.slotIndex, starts);
    }
    for (const [slotIndex, starts] of bySlot) {
      const at = Math.min(...starts);
      const end = Math.max(...starts) + duration;
      if (end <= week.start.getTime() || at >= week.end.getTime()) continue;
      const slot = job.schedule.type === 'times' ? job.schedule.slots[slotIndex] : undefined;
      waves.push({
        jobId: job.id,
        jobName: job.name,
        customerId: job.customerId,
        customerName: job.customerName,
        slotIndex,
        slot:
          slot && job.schedule.type === 'times'
            ? { date: slot.date, time: slot.time, timezone: job.schedule.timezone }
            : null,
        at: new Date(at),
        end: new Date(end),
        runs: starts.length * targets,
        spans: starts.flatMap((start) =>
          Array.from({ length: targets }, (): [number, number] => [start, start + duration]),
        ),
      });
    }
  }
  return waves.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Starts and ends of runs, in order; a browser that frees up is free for a run at that moment. */
function events(waves: readonly Wave[]) {
  return waves
    .flatMap((wave, index) =>
      wave.spans.flatMap(([start, end]) => [
        { at: start, delta: 1, index },
        { at: end, delta: -1, index },
      ]),
    )
    .sort((a, b) => a.at - b.at || a.delta - b.delta);
}

/** The stretches of time in which more runs would run than there are browsers. */
export function overloads(waves: readonly Wave[], limit: number): Busy[] {
  const found: Busy[] = [];
  const running = new Map<number, number>();
  let count = 0;
  let current: { start: number; peak: number; waves: Set<number> } | null = null;
  for (const { at, delta, index } of events(waves)) {
    count += delta;
    running.set(index, (running.get(index) ?? 0) + delta);
    if (count > limit) {
      if (!current) {
        const active = [...running].filter(([, n]) => n > 0).map(([wave]) => wave);
        current = { start: at, peak: count, waves: new Set(active.sort((a, b) => a - b)) };
      }
      current.peak = Math.max(current.peak, count);
      if (delta > 0) current.waves.add(index);
    } else if (current) {
      found.push({
        start: new Date(current.start),
        end: new Date(at),
        peak: current.peak,
        waves: [...current.waves].map((wave) => waves[wave] as Wave),
      });
      current = null;
    }
  }
  return found;
}

/** The most runs at once within a stretch of time. */
function peakWithin(waves: readonly Wave[], from: number, to: number): number {
  const clipped = waves
    .map((wave) => ({
      ...wave,
      spans: wave.spans
        .filter(([start, end]) => end > from && start < to)
        .map(([start, end]): [number, number] => [Math.max(start, from), Math.min(end, to)]),
    }))
    .filter((wave) => wave.spans.length > 0);
  let count = 0;
  let peak = 0;
  for (const { delta } of events(clipped)) {
    count += delta;
    peak = Math.max(peak, count);
  }
  return peak;
}

/** The entries of a day: one per wave, or one per job for jobs that start many times. */
export function dayEntries(
  waves: readonly Wave[],
  date: string,
  busy: readonly Busy[],
): DayEntry[] {
  const waiting = new Set(busy.flatMap((stretch) => stretch.waves));
  const byJob = new Map<string, Wave[]>();
  for (const wave of waves) {
    if (local(wave.at).date !== date) continue;
    byJob.set(wave.jobId, [...(byJob.get(wave.jobId) ?? []), wave]);
  }
  const entries: DayEntry[] = [];
  for (const [jobId, ofJob] of byJob) {
    const entry = (group: Wave[], time: string): DayEntry => ({
      jobId,
      time,
      name: (group[0] as Wave).jobName,
      runs: group.reduce((sum, wave) => sum + wave.runs, 0),
      over: group.some((wave) => waiting.has(wave)),
    });
    if (ofJob.length >= SUMMARY_FROM) {
      const first = local((ofJob[0] as Wave).at).time;
      const last = local((ofJob.at(-1) as Wave).at).time;
      entries.push(entry(ofJob, `${first}–${last}`));
    } else {
      entries.push(...ofJob.map((wave) => entry([wave], local(wave.at).time)));
    }
  }
  return entries.sort((a, b) => a.time.localeCompare(b.time));
}

/** The busiest moment of a day and the overloads that begin on it. */
export function dayLoad(
  waves: readonly Wave[],
  busy: readonly Busy[],
  date: string,
): { peak: number; busy: Busy[] } {
  const from = midnight(date).getTime();
  const to = midnight(addDays(date, 1)).getTime();
  return {
    peak: peakWithin(waves, from, to),
    busy: busy.filter((stretch) => stretch.start.getTime() >= from && stretch.start.getTime() < to),
  };
}

/**
 * A new time for one date of the overload, as early as possible within two hours, so that no run
 * waits any more. Only dates of the current project that do not start within the next minutes.
 */
export function suggestMove(
  waves: readonly Wave[],
  busy: Busy,
  limit: number,
  { now, project }: { now: Date; project: string },
): SlotSuggestion | null {
  const candidates = busy.waves
    .filter(
      (wave) =>
        wave.slot !== null &&
        wave.customerId === project &&
        wave.at.getTime() > now.getTime() + SETTLE_MS,
    )
    // The latest and smallest wave moves; on a tie the one that came last.
    .sort(
      (a, b) =>
        b.at.getTime() - a.at.getTime() ||
        a.runs - b.runs ||
        busy.waves.indexOf(b) - busy.waves.indexOf(a),
    );

  for (const wave of candidates) {
    const slot = wave.slot as NonNullable<Wave['slot']>;
    const taken = new Set(
      waves
        .filter((other) => other.jobId === wave.jobId && other.slot)
        .map((other) => `${other.slot?.date} ${other.slot?.time}`),
    );
    const nearby = waves.filter(
      (other) =>
        other !== wave &&
        other.end.getTime() > busy.start.getTime() - NEARBY_MS &&
        other.at.getTime() < busy.end.getTime() + NEARBY_MS,
    );
    for (let minutes = 1; minutes <= SUGGEST_WITHIN; minutes++) {
      const shift = minutes * MIN;
      const at = wave.at.getTime() + shift;
      const to = local(at, slot.timezone);
      if (taken.has(`${to.date} ${to.time}`)) continue;
      // The hour the clock change skips has no such time.
      if (localToUtc(to.date, to.time, slot.timezone)?.getTime() !== at) continue;
      const moved: Wave = {
        ...wave,
        at: new Date(at),
        end: new Date(wave.end.getTime() + shift),
        spans: wave.spans.map(([start, end]): [number, number] => [start + shift, end + shift]),
      };
      const plan = [...nearby, moved];
      const stillBusy = overloads(plan, limit).some(
        (stretch) =>
          stretch.waves.includes(moved) ||
          (stretch.start.getTime() < busy.end.getTime() &&
            stretch.end.getTime() > busy.start.getTime()),
      );
      if (stillBusy) continue;
      return {
        jobId: wave.jobId,
        jobName: wave.jobName,
        slotIndex: wave.slotIndex,
        from: { date: slot.date, time: slot.time },
        to,
        peak: peakWithin(plan, busy.start.getTime(), moved.end.getTime()),
      };
    }
  }
  return null;
}

const runsText = (runs: number) => (runs === 1 ? '1 Durchlauf' : `${runs} Durchläufe`);

function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} und ${items.at(-1)}`;
}

/** Heading and explanation of an overload for the load panel. */
export function describeBusy(
  busy: Busy,
  limit: number,
  project: string,
): { title: string; text: string } {
  const jobs = new Map<string, { wave: Wave; runs: number }>();
  for (const wave of busy.waves) {
    const known = jobs.get(wave.jobId);
    jobs.set(wave.jobId, { wave, runs: (known?.runs ?? 0) + wave.runs });
  }
  const names = [...jobs.values()].map(({ wave, runs }) => {
    const owner = wave.customerId === project ? '' : `${wave.customerName}, `;
    return `„${wave.jobName}“ (${owner}${runsText(runs)})`;
  });
  const waiting = busy.peak - limit;
  const together =
    names.length === 1
      ? `${list(names)} startet mehr Durchläufe, als Browser frei sind.`
      : `${list(names)} laufen gleichzeitig.`;
  const late =
    waiting === 1
      ? '1 Durchlauf wartet in der Warteschlange und startet später als geplant.'
      : `${waiting} Durchläufe warten in der Warteschlange und starten später als geplant.`;
  return {
    title: `${local(busy.start).time} Uhr: ${busy.peak} Durchläufe für ${limit} Browser`,
    text: `${together} ${late}`,
  };
}

/** Heading and explanation of a suggested move. */
export function describeSuggestion(
  move: SlotSuggestion,
  limit: number,
): { title: string; text: string } {
  const when =
    move.to.date === move.from.date
      ? move.to.time
      : `${dayLabel(move.to.date, 'long')} ${move.to.time}`;
  return {
    title: `Vorschlag: „${move.jobName}“ auf ${when} verschieben`,
    text: `Dann laufen höchstens ${move.peak} von ${limit} Browsern gleichzeitig, und alle Durchläufe starten pünktlich.`,
  };
}
