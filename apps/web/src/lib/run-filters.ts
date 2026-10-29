import { DEVICE_OPTIONS, type DeviceKey } from './devices';
import { plural } from './format';

/**
 * Filters of screen 14 "Läufe". They live in the address (GET form), so a filtered view can be
 * bookmarked or sent as a link and works without JavaScript.
 */

export const PAGE_SIZE = 50;
const DAY_MS = 86_400_000;

type RunStatus = 'queued' | 'running' | 'passed' | 'warning' | 'failed' | 'cancelled';

const RESULTS = {
  erfolgreich: { label: 'Erfolgreich', statuses: ['passed'] },
  hinweis: { label: 'Mit Hinweis', statuses: ['warning'] },
  fehlgeschlagen: { label: 'Fehlgeschlagen', statuses: ['failed'] },
  offen: { label: 'Geplant oder läuft', statuses: ['queued', 'running'] },
  abgebrochen: { label: 'Abgebrochen', statuses: ['cancelled'] },
} as const satisfies Record<string, { label: string; statuses: readonly RunStatus[] }>;

const PERIODS = {
  '24h': { label: 'Letzte 24 Stunden', days: 1 },
  '7d': { label: 'Letzte 7 Tage', days: 7 },
  '30d': { label: 'Letzte 30 Tage', days: 30 },
  alle: { label: 'Gesamter Zeitraum', days: null },
} as const;

export type ResultKey = keyof typeof RESULTS;
export type PeriodKey = keyof typeof PERIODS;

export type RunFilters = {
  /** Id of a campaign of the current project, or '' for all of them. */
  kampagne: string;
  ergebnis: ResultKey | '';
  zeitraum: PeriodKey;
  geraet: DeviceKey | '';
  /** 1-based page. */
  seite: number;
};

export const DEFAULT_RUN_FILTERS: RunFilters = {
  kampagne: '',
  ergebnis: '',
  zeitraum: '7d',
  geraet: '',
  seite: 1,
};

export const RESULT_OPTIONS = Object.entries(RESULTS).map(([value, { label }]) => ({
  value,
  label,
}));
export const PERIOD_OPTIONS = Object.entries(PERIODS).map(([value, { label }]) => ({
  value,
  label,
}));
export const DEVICE_FILTER_OPTIONS = DEVICE_OPTIONS.map(({ key, label }) => ({
  value: key,
  label,
}));

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

const isKey = <T extends object>(object: T, key: string): key is Extract<keyof T, string> =>
  Object.hasOwn(object, key);

/** Filters from the address; unknown values fall back to the defaults. */
export function parseRunFilters(params: SearchParams): RunFilters {
  const ergebnis = first(params, 'ergebnis');
  const zeitraum = first(params, 'zeitraum');
  const geraet = first(params, 'geraet');
  const seite = Number(first(params, 'seite'));
  return {
    kampagne: first(params, 'kampagne'),
    ergebnis: isKey(RESULTS, ergebnis) ? ergebnis : '',
    zeitraum: isKey(PERIODS, zeitraum) ? zeitraum : DEFAULT_RUN_FILTERS.zeitraum,
    geraet: DEVICE_OPTIONS.some((option) => option.key === geraet) ? (geraet as DeviceKey) : '',
    seite: Number.isInteger(seite) && seite >= 1 ? seite : 1,
  };
}

export type RunQuery = {
  campaignId?: string;
  statuses?: RunStatus[];
  since?: Date;
  device?: DeviceKey;
  limit: number;
  offset: number;
};

/** Arguments for listRuns. */
export function toRunQuery(filters: RunFilters, now: Date): RunQuery {
  const days = PERIODS[filters.zeitraum].days;
  return {
    ...(filters.kampagne ? { campaignId: filters.kampagne } : {}),
    ...(filters.ergebnis ? { statuses: [...RESULTS[filters.ergebnis].statuses] } : {}),
    ...(days ? { since: new Date(now.getTime() - days * DAY_MS) } : {}),
    ...(filters.geraet ? { device: filters.geraet } : {}),
    limit: PAGE_SIZE,
    offset: (filters.seite - 1) * PAGE_SIZE,
  };
}

/** Link to `page` with the same filters; default values stay out of the address. */
export function pageHref(filters: RunFilters, page: number): string {
  const params = new URLSearchParams();
  const { seite: _page, ...values } = { ...filters, seite: page };
  for (const [key, value] of Object.entries(values)) {
    if (value !== DEFAULT_RUN_FILTERS[key as keyof RunFilters]) params.set(key, String(value));
  }
  if (page > 1) params.set('seite', String(page));
  const query = params.toString();
  return query ? `/laeufe?${query}` : '/laeufe';
}

/** "1–50 von 1.240 · neueste zuerst" above the table. */
export function describePage(total: number, page: number): string {
  if (total === 0) return 'keine Läufe';
  if (total === 1) return '1 Lauf';
  if (total <= PAGE_SIZE) return `${plural(total, 'Lauf', 'Läufe')} · neueste zuerst`;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const de = (value: number) => value.toLocaleString('de-DE');
  return `${de(from)}–${de(to)} von ${de(total)} · neueste zuerst`;
}
