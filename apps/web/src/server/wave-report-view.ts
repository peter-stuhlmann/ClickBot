import 'server-only';
import type { WaveReport, WaveRun } from '@click-bot/db';
import { browserLabel, deviceLabel } from '@/lib/devices';
import { formatClock, formatDateLong, formatDuration, plural } from '@/lib/format';
import { toStepDraft } from '@/lib/job-draft';
import { describeStep } from '@/lib/step-view';
import type { StatCardView, Tone, WaveReportView, WaveRunRowView } from '@/lib/views';
import { RUN_BADGE } from './jobs-view';

const DASH = '–';

// "16:17", without seconds: the title names the start, the stats keep the exact second.
const shortClock = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

const durationOf = (run: WaveRun) =>
  run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

/** "Desktop (Firefox)" */
const whereOf = (run: WaveRun) => `${deviceLabel(run.device)} (${browserLabel(run.browser)})`;

/** "Schritt 7 · Klicke auf „Weiter“" */
function failedStepTitle(report: WaveReport, run: WaveRun): string | null {
  if (!run.failedStep) return null;
  const step = report.flow.steps.find((candidate) => candidate.id === run.failedStep?.stepId);
  const draft = step ? toStepDraft(step) : null;
  const number = `Schritt ${run.failedStep.stepIndex + 1}`;
  return draft ? `${number} · ${describeStep(draft).title}` : number;
}

function reasonOf(run: WaveRun): string | null {
  if (run.status !== 'failed' && run.status !== 'cancelled') return null;
  return run.failedStep?.message ?? run.error;
}

function overallStatus(runs: WaveRun[]): { tone: Tone; label: string } {
  const statuses = new Set(runs.map((run) => run.status));
  if (statuses.has('running')) return RUN_BADGE.running;
  if (statuses.has('queued')) return RUN_BADGE.queued;
  if (statuses.has('failed')) return RUN_BADGE.failed;
  if (statuses.has('warning')) return RUN_BADGE.warning;
  if (statuses.has('cancelled')) return RUN_BADGE.cancelled;
  return RUN_BADGE.passed;
}

function liveHint(runs: WaveRun[], workerOnline: boolean): string | null {
  const open = runs.filter((run) => run.status === 'queued' || run.status === 'running').length;
  if (open === 0) return null;
  if (runs.some((run) => run.status === 'running')) {
    return `${plural(open, 'Durchlauf läuft', 'Durchläufe laufen')} noch. Der Report aktualisiert sich selbst.`;
  }
  return workerOnline
    ? `${plural(open, 'Durchlauf wartet', 'Durchläufe warten')} auf das Testsystem. Der Report aktualisiert sich selbst.`
    : 'Das Testsystem ist nicht verbunden. Die Durchläufe starten, sobald es wieder läuft.';
}

/** The failures grouped by step (or by message, when a run never got to a step). */
function failures(report: WaveReport): WaveReportView['failures'] {
  const groups = new Map<string, { title: string; message: string; where: string[] }>();
  for (const run of report.runs) {
    if (run.status !== 'failed') continue;
    const title = failedStepTitle(report, run) ?? 'Durchlauf konnte nicht ausgeführt werden';
    const message = reasonOf(run) ?? '';
    const key = `${title}\n${message}`;
    const group = groups.get(key) ?? { title, message, where: [] };
    group.where.push(whereOf(run));
    groups.set(key, group);
  }
  return [...groups.values()].map(({ where, ...group }) => ({ ...group, where: where.join(', ') }));
}

function stats(report: WaveReport, startedAt: Date | null): StatCardView[] {
  const { runs } = report;
  const passed = runs.filter((run) => run.status === 'passed' || run.status === 'warning');
  const failed = runs.filter((run) => run.status === 'failed');
  const open = runs.filter((run) => run.status === 'queued' || run.status === 'running');
  const durations = runs.map(durationOf).filter((ms): ms is number => ms !== null);
  const longest = durations.length > 0 ? Math.max(...durations) : null;
  const average =
    durations.length > 0
      ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length)
      : null;
  const resultHint = [
    failed.length > 0 && `${failed.length} fehlgeschlagen`,
    open.length > 0 && `${open.length} noch offen`,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    {
      label: 'Durchläufe',
      value: `${passed.length} / ${runs.length}`,
      hint: resultHint || 'alle bestanden',
    },
    {
      label: 'Fehlgeschlagen',
      value: String(failed.length),
      hint: failed.length > 0 ? failed.map(whereOf).join(', ') : 'kein Durchlauf',
    },
    {
      label: 'Dauer',
      value: longest === null ? DASH : formatDuration(longest),
      hint:
        average === null ? 'noch kein Durchlauf fertig' : `längster · Ø ${formatDuration(average)}`,
    },
    {
      label: 'Start',
      value: startedAt ? formatClock(startedAt) : DASH,
      hint: `geplant ${formatClock(report.scheduledAt)}`,
    },
  ];
}

/** Screen 03b: one start of a job on every device and browser, with where and why it failed. */
export function toWaveReportView(
  report: WaveReport,
  { workerOnline = true }: { workerOnline?: boolean } = {},
): WaveReportView {
  const { runs } = report;
  const started = runs.map((run) => run.startedAt).filter((at): at is Date => at !== null);
  const startedAt =
    started.length > 0 ? new Date(Math.min(...started.map((at) => at.getTime()))) : null;
  const devices = new Set(runs.map((run) => run.device)).size;
  const failed = runs.filter((run) => run.status === 'failed').length;

  return {
    jobName: report.job.name,
    jobHref: `/jobs/${report.job.id}`,
    title: `Start ${shortClock.format(startedAt ?? report.scheduledAt)} Uhr`,
    status: overallStatus(runs),
    meta: [
      formatDateLong(startedAt ?? report.scheduledAt),
      report.manual ? 'manuell gestartet' : 'ausgelöst durch Zeitplan',
      `${plural(runs.length, 'Durchlauf', 'Durchläufe')} auf ${plural(devices, 'Gerät', 'Geräten')}`,
    ].join(' · '),
    stats: stats(report, startedAt),
    summary: [
      plural(runs.length, 'Durchlauf', 'Durchläufe'),
      failed > 0 ? `${failed} fehlgeschlagen` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    rows: runs.map((run): WaveRunRowView => ({
      id: run.id,
      href: `/laeufe/${run.id}`,
      device: deviceLabel(run.device),
      browser: browserLabel(run.browser),
      status: RUN_BADGE[run.status],
      failedStep: failedStepTitle(report, run),
      reason: reasonOf(run),
      duration: durationOf(run) === null ? DASH : formatDuration(durationOf(run) as number),
      failed: run.status === 'failed',
    })),
    failures: failures(report),
    live: liveHint(runs, workerOnline),
  };
}
