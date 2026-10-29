import 'server-only';
import type { CustomerOverviewRow, CustomerStats } from '@click-bot/db';
import { formatPercent, formatRelative, plural } from '@/lib/format';
import type { CustomerRowView, StatCardView } from '@/lib/views';
import { RUN_BADGE, successTone } from './jobs-view';

/** Screen 10: one row of the customer table. */
export function toCustomerRow(row: CustomerOverviewRow, now: Date): CustomerRowView {
  const [firstHost] = row.hosts;
  const { finished, successful } = row.runs30d;
  const rate = finished > 0 ? successful / finished : null;
  return {
    id: row.id,
    name: row.name,
    websites: firstHost
      ? `${firstHost} · ${plural(row.hosts.length, 'Website', 'Websites')}`
      : 'noch keine Website',
    jobs: {
      primary: plural(row.jobs.total, 'Job', 'Jobs'),
      secondary:
        row.jobs.total > 0
          ? `${row.jobs.active} aktiv · ${row.jobs.finished} beendet`
          : 'noch keine Jobs',
    },
    runs: {
      label:
        rate === null
          ? 'keine Läufe'
          : `${plural(finished, 'Lauf', 'Läufe')} · ${formatPercent(rate)} ok`,
      value: rate ?? 0,
    },
    lastRun: row.lastRun
      ? {
          ...RUN_BADGE[row.lastRun.status],
          when: formatRelative(row.lastRun.finishedAt, now),
          href: `/laeufe/${row.lastRun.id}`,
        }
      : null,
    successRate: rate === null ? null : { text: formatPercent(rate), tone: successTone(rate) },
  };
}

function change(current: number, previous: number): string {
  if (previous === 0) return 'kein Vergleich';
  const percent = Math.round(((current - previous) / previous) * 100);
  // U+2212 is the typographic minus sign.
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '±';
  return `${sign}${Math.abs(percent)} % zu den 30 Tagen davor`;
}

/** The four figures above the customer table. */
export function toCustomerStatCards(stats: CustomerStats): StatCardView[] {
  const { successful, finished } = stats.successRate30d;
  return [
    {
      label: 'Projekte',
      value: String(stats.customers),
      hint:
        stats.customers > 0 ? `${stats.newThisMonth} neu in diesem Monat` : 'noch keine Projekte',
    },
    {
      label: 'Jobs gesamt',
      value: String(stats.jobs.total),
      hint: `${stats.jobs.active} aktiv · ${stats.jobs.finished} beendet`,
    },
    {
      label: 'Läufe (30 Tage)',
      value: stats.runs30d.toLocaleString('de-DE'),
      hint: change(stats.runs30d, stats.runsPrevious30d),
    },
    {
      label: 'Erfolgsquote (30 Tage)',
      value: finished > 0 ? formatPercent(successful / finished) : '–',
      hint:
        finished > 0
          ? `${successful.toLocaleString('de-DE')} von ${plural(finished, 'Lauf', 'Läufen')}`
          : 'noch keine Läufe',
    },
  ];
}
