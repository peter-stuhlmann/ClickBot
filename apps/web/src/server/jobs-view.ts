import 'server-only';
import type { DashboardStats, JobOverviewRow } from '@click-bot/db';

type RunStatus = NonNullable<JobOverviewRow['lastRun']>['status'];
import { describeSchedule, displayUrl, formatPercent, formatRelative, plural } from '@/lib/format';
import type { JobRowView, StatCardView, Tone } from '@/lib/views';

export const RUN_BADGE: Record<RunStatus, { tone: Tone; label: string }> = {
  passed: { tone: 'success', label: 'Bestanden' },
  warning: { tone: 'warning', label: 'Mit Hinweis' },
  // The flow ran, but the expectation of the test is not met.
  not_passed: { tone: 'danger', label: 'Nicht bestanden' },
  // The flow itself broke, e.g. an element was not found.
  failed: { tone: 'danger', label: 'Fehlgeschlagen' },
  cancelled: { tone: 'neutral', label: 'Abgebrochen' },
  running: { tone: 'neutral', label: 'Läuft' },
  queued: { tone: 'neutral', label: 'Geplant' },
};

const JOB_STATUS: Record<JobOverviewRow['status'], JobRowView['status']> = {
  active: { label: 'Aktiv', active: true, toggleable: true },
  paused: { label: 'Pausiert', active: false, toggleable: true },
  draft: { label: 'Entwurf', active: false, toggleable: false },
  finished: { label: 'Beendet', active: false, toggleable: false },
};

export function successTone(rate: number): Tone {
  if (rate >= 0.95) return 'success';
  if (rate >= 0.85) return 'warning';
  return 'danger';
}

export function toJobRow(row: JobOverviewRow, now: Date): JobRowView {
  const progress = row.runsPlanned > 0 ? Math.min(1, row.runsDone / row.runsPlanned) : 0;
  return {
    id: row.id,
    name: row.name,
    // A draft the wizard keeps the form of is continued there, where it was left.
    href: row.inWizard ? `/jobs/neu?entwurf=${row.id}` : `/jobs/${row.id}`,
    campaign: row.campaignName,
    url: displayUrl(row.startUrl),
    schedule: describeSchedule(row.schedule),
    progress: { label: `${row.runsDone} / ${row.runsPlanned} Durchläufe`, value: progress },
    lastRun: row.lastRun
      ? {
          ...RUN_BADGE[row.lastRun.status],
          when: formatRelative(row.lastRun.finishedAt, now),
          href: `/laeufe/${row.lastRun.id}`,
        }
      : null,
    successRate:
      row.successRate === null
        ? null
        : { text: formatPercent(row.successRate), tone: successTone(row.successRate) },
    status: JOB_STATUS[row.status],
  };
}

function difference(today: number, yesterday: number): string {
  const diff = today - yesterday;
  if (diff === 0) return 'wie gestern';
  // U+2212 is the typographic minus sign.
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} gegenüber gestern`;
}

function shortList(names: string[], visible = 2): string {
  const rest = names.length - visible;
  return rest > 0 ? `${names.slice(0, visible).join(', ')} +${rest}` : names.join(', ');
}

export function toStatCards(stats: DashboardStats): StatCardView[] {
  const { successful, finished } = stats.successRate7d;
  return [
    {
      label: 'Aktive Tests',
      value: String(stats.activeJobs),
      hint:
        stats.finishedJobs > 0
          ? `${plural(stats.finishedJobs, 'Test', 'Tests')} beendet`
          : 'keine beendeten Tests',
    },
    {
      label: 'Durchläufe heute',
      value: stats.runsToday.toLocaleString('de-DE'),
      hint: difference(stats.runsToday, stats.runsYesterday),
    },
    {
      label: 'Erfolgsquote (7 Tage)',
      value: finished > 0 ? formatPercent(successful / finished) : '–',
      hint:
        finished > 0
          ? `${successful} von ${plural(finished, 'Durchlauf', 'Durchläufen')}`
          : 'noch keine Durchläufe',
    },
    {
      label: 'Fehler (24 Std.)',
      value: String(stats.failures24h.count),
      hint: stats.failures24h.count > 0 ? shortList(stats.failures24h.jobNames) : 'keine Fehler',
    },
  ];
}
