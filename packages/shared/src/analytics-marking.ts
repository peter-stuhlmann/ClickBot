import { z } from 'zod';

/**
 * How the worker marks the GA4 requests of a bot run (apps/worker/src/bot-marking.ts). On by
 * default; a job can switch markings off, e.g. to see its events in the regular GA4 reports.
 * Every run records the markings it ran with, and its report says when some were off.
 */
export const analyticsMarkingSchema = z
  .object({
    /** `_dbg=1`: events only in DebugView, never in the reports. */
    debugMode: z.boolean().default(true),
    /** `ep.traffic_type=internal`: excluded by an active "Internal traffic" filter. */
    internalTraffic: z.boolean().default(true),
    /** `ep.click_bot=1`: our own marker, to filter bot runs. */
    botFlag: z.boolean().default(true),
    /** `epn.click_bot_run=<run number>`: which run sent an event. */
    runNumber: z.boolean().default(true),
  })
  .strict()
  .default({ debugMode: true, internalTraffic: true, botFlag: true, runNumber: true });

export type AnalyticsMarking = z.infer<typeof analyticsMarkingSchema>;
export type MarkingKey = keyof AnalyticsMarking;

export const ALL_MARKINGS_ON: AnalyticsMarking = {
  debugMode: true,
  internalTraffic: true,
  botFlag: true,
  runNumber: true,
};

export const MARKING_LABELS: Record<MarkingKey, string> = {
  debugMode: 'Debug-Modus',
  internalTraffic: 'Interner Traffic',
  botFlag: 'Bot-Kennung',
  runNumber: 'Laufnummer',
};

const KEYS = Object.keys(MARKING_LABELS) as MarkingKey[];

export function markingState(marking: AnalyticsMarking): 'on' | 'partial' | 'off' {
  const on = KEYS.filter((key) => marking[key]).length;
  if (on === KEYS.length) return 'on';
  return on === 0 ? 'off' : 'partial';
}

/** "Aus: Debug-Modus, Interner Traffic", or null while everything is on. */
export function describeMarking(marking: AnalyticsMarking): string | null {
  const off = KEYS.filter((key) => !marking[key]);
  if (off.length === 0) return null;
  if (off.length === KEYS.length) return 'Aus: alle Markierungen';
  return `Aus: ${off.map((key) => MARKING_LABELS[key]).join(', ')}`;
}
