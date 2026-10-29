import 'server-only';
import type { CampaignOverviewRow, CampaignStats } from '@click-bot/db';
import { formatPercent, formatRelative, plural } from '@/lib/format';
import type { CampaignRowView, StatCardView } from '@/lib/views';
import { RUN_BADGE, successTone } from './jobs-view';

/** "2026-11-20" → "20.11.2026"; parts split, so the year can be left out of a range. */
function parts(date: string): { day: string; year: string } {
  const [year = '', month = '', day = ''] = date.split('-');
  return { day: `${day}.${month}.`, year };
}

/** "20.11.–30.11.2026", "ab 20.11.2026", "bis 30.11.2026", or null without a period. */
export function describePeriod(startsOn: string | null, endsOn: string | null): string | null {
  if (startsOn && endsOn) {
    const from = parts(startsOn);
    const to = parts(endsOn);
    const start = from.year === to.year ? from.day : `${from.day}${from.year}`;
    return `${start}–${to.day}${to.year}`;
  }
  if (startsOn) return `ab ${parts(startsOn).day}${parts(startsOn).year}`;
  if (endsOn) return `bis ${parts(endsOn).day}${parts(endsOn).year}`;
  return null;
}

/** One row of the campaign table. */
export function toCampaignRow(row: CampaignOverviewRow, now: Date): CampaignRowView {
  const [firstHost] = row.hosts;
  const { finished, successful } = row.runs30d;
  const rate = finished > 0 ? successful / finished : null;
  const websites = firstHost
    ? `${firstHost} · ${plural(row.hosts.length, 'Website', 'Websites')}`
    : 'noch keine Website';
  return {
    id: row.id,
    name: row.name,
    detail: [describePeriod(row.startsOn, row.endsOn), websites].filter(Boolean).join(' · '),
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

/** The four figures above the campaign table, for the current project. */
export function toCampaignStatCards(stats: CampaignStats): StatCardView[] {
  const { successful, finished } = stats.successRate30d;
  return [
    {
      label: 'Kampagnen',
      value: String(stats.campaigns),
      hint: stats.campaigns > 0 ? 'in diesem Projekt' : 'noch keine Kampagnen',
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
