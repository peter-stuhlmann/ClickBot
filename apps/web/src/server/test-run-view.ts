import 'server-only';
import type { RunReport } from '@click-bot/db';
import { browserLabel, deviceLabel } from '@/lib/devices';
import { NO_AI_COST } from '@/lib/cost';
import { formatDuration, plural } from '@/lib/format';
import { toStepDraft } from '@/lib/job-draft';
import { describeStep } from '@/lib/step-view';
import type { CostView, TestRunView } from '@/lib/views';
import { RUN_BADGE } from './jobs-view';
import { toVideoView } from './run-report-view';

function message(report: RunReport, workerOnline: boolean, failedIndex: number | null): string {
  const { run, steps } = report;
  switch (run.status) {
    case 'queued':
      return workerOnline
        ? 'Wartet auf einen freien Browser.'
        : 'Das Testsystem ist nicht verbunden. Der Testlauf startet, sobald es läuft.';
    case 'running':
      return 'Läuft gerade …';
    case 'passed': {
      const duration =
        run.startedAt && run.finishedAt
          ? `, in ${formatDuration(run.finishedAt.getTime() - run.startedAt.getTime())}`
          : '';
      return `Alle ${plural(steps.length, 'Schritt', 'Schritte')} bestanden${duration}.`;
    }
    case 'warning':
      return 'Durchgelaufen, mit Hinweis. Was nicht prüfbar war, steht im Report.';
    case 'not_passed':
      return failedIndex === null
        ? 'Nicht bestanden.'
        : `Nicht bestanden: Der Ablauf lief durch, aber die Erwartung bei Schritt ${failedIndex + 1} ist nicht erfüllt.`;
    case 'failed':
      return failedIndex === null
        ? 'Fehlgeschlagen: Der Testlauf konnte nicht ausgeführt werden.'
        : `Fehlgeschlagen: Der Ablauf bricht bei Schritt ${failedIndex + 1} ab.`;
    case 'cancelled':
      return 'Der Testlauf wurde abgebrochen.';
  }
}

/** The "Testlauf" of the wizard: one run of the draft, shown below its flow until it is done. */
export function toTestRunView(
  report: RunReport,
  { workerOnline = true, cost = NO_AI_COST }: { workerOnline?: boolean; cost?: CostView } = {},
): TestRunView {
  const { run } = report;
  const failed = report.steps.find((step) => step.status === 'failed') ?? null;
  const failedIndex = failed?.stepIndex ?? null;
  const step = failed && report.job.flow.steps.find((candidate) => candidate.id === failed.stepId);
  const draft = step ? toStepDraft(step) : null;
  const number = failedIndex === null ? null : `Schritt ${failedIndex + 1}`;
  const ended =
    run.status === 'failed' || run.status === 'not_passed' || run.status === 'cancelled';
  return {
    runId: run.id,
    href: `/laeufe/${run.id}`,
    status: run.status === 'queued' ? { tone: 'neutral', label: 'Wartet' } : RUN_BADGE[run.status],
    open: run.status === 'queued' || run.status === 'running',
    where: `${deviceLabel(run.device)} · ${browserLabel(run.browser)}`,
    message: message(report, workerOnline, failedIndex),
    failedIndex,
    failedStep: number && draft ? `${number} · ${describeStep(draft).title}` : number,
    reason: ended ? (failed?.message ?? run.error) : null,
    video: toVideoView(report),
    summary: report.steps.find((row) => row.aiSummary)?.aiSummary ?? null,
    cost,
  };
}
