import 'server-only';
import type { RunReport, RunStepRow } from '@click-bot/db';
import { describeMarking, markingState, type AnalyticsMarking, type Step } from '@click-bot/shared';
import { browserLabel, deviceLabel } from '@/lib/devices';
import { formatClock, formatDateLong, formatDuration, plural } from '@/lib/format';
import { toStepDraft } from '@/lib/job-draft';
import { screenshotAnchor } from '@/lib/screenshots';
import { describeStep } from '@/lib/step-view';
import type { RunReportView, RunStepView, ScreenshotView, StatCardView } from '@/lib/views';
import { RUN_BADGE } from './jobs-view';

const DASH = '–';

// Step types the forms cannot show yet still get a readable title.
const OTHER_TITLES: Partial<Record<Step['type'], string>> = {
  extract: 'Wert auslesen',
};

function describe(step: Step | undefined, stepId: string): { title: string; detail: string } {
  const draft = step ? toStepDraft(step) : null;
  if (draft) {
    const { title, detail } = describeStep(draft);
    return { title, detail };
  }
  return { title: (step && OTHER_TITLES[step.type]) ?? `Schritt „${stepId}“`, detail: '' };
}

const artifactUrl = (path: string) => `/artifacts/${path}`;

function stepViews(report: RunReport): RunStepView[] {
  const { flow } = report.job;
  if (report.steps.length === 0) {
    return flow.steps.map((step, index) => ({
      number: index + 1,
      status: 'pending',
      ...describe(step, step.id),
      duration: DASH,
      screenshotHref: null,
    }));
  }
  return report.steps.map((row) => {
    const { title, detail } = describe(
      flow.steps.find((step) => step.id === row.stepId),
      row.stepId,
    );
    return {
      number: row.stepIndex + 1,
      status: row.status,
      title,
      detail: row.message ?? detail,
      duration: row.status === 'skipped' ? DASH : formatDuration(row.durationMs),
      screenshotHref: row.screenshotPath ? `#${screenshotAnchor(row.stepIndex + 1)}` : null,
      ...(row.aiActions ? { aiActions: row.aiActions } : {}),
      ...(row.aiVerdict ? { aiVerdict: row.aiVerdict } : {}),
    };
  });
}

function screenshotViews(report: RunReport, steps: RunStepView[]): ScreenshotView[] {
  return report.steps.flatMap((row) => {
    if (!row.screenshotPath) return [];
    const step = row.stepIndex + 1;
    const title = steps.find((view) => view.number === step)?.title ?? `Schritt ${step}`;
    return [{ url: artifactUrl(row.screenshotPath), step, title }];
  });
}

function stepsHint(report: RunReport, failed: RunStepRow | undefined): string {
  if (failed) return `Abbruch bei Schritt ${failed.stepIndex + 1}`;
  const unclear = report.steps.filter((step) => step.status === 'unclear').length;
  if (unclear > 0) return `${unclear} nicht ganz prüfbar`;
  if (report.steps.length > 0) return 'alle bestanden';
  if (report.run.status === 'queued') return 'noch nicht gestartet';
  if (report.run.status === 'running') return 'läuft gerade';
  return 'keine Schritt-Ergebnisse';
}

function startHint(scheduledAt: Date, startedAt: Date | null): string {
  const planned = `geplant ${formatClock(scheduledAt)}`;
  if (!startedAt) return planned;
  const late = Math.round((startedAt.getTime() - scheduledAt.getTime()) / 1000);
  return `${planned} · ${late < 1 ? 'pünktlich' : `${late} s später`}`;
}

/** "Lauf #7 von 20"; a test run is no part of the schedule and says so instead. */
function runTitle(runNr: number, slotIndex: number | null, planned: number): string {
  if (slotIndex === null) return `Durchlauf ${runNr} · manuell gestartet`;
  return runNr <= planned ? `Durchlauf ${runNr} von ${planned}` : `Durchlauf ${runNr}`;
}

/** Report note when the run did not mark its GA4 requests completely (product rule). */
function markingNote(marking: AnalyticsMarking | null): RunReportView['marking'] {
  if (!marking) return null;
  const state = markingState(marking);
  if (state === 'on') return null;
  if (state === 'off') {
    return {
      title: 'Ohne GA4-Markierung',
      message:
        'Dieser Durchlauf war in GA4 nicht als Browser erkennbar. Seine Ereignisse zählen dort wie echte Besuche.',
    };
  }
  const reports = marking.debugMode
    ? 'Die GA4-Ereignisse dieses Durchlaufs sind nur zum Teil gekennzeichnet.'
    : 'Die GA4-Ereignisse dieses Durchlaufs können in den normalen Berichten erscheinen.';
  return {
    title: 'GA4-Markierung eingeschränkt',
    message: `${describeMarking(marking)}. ${reports}`,
  };
}

/** Report note when the run loaded ads (product rule: no fake ad impressions). */
function adsNote(adsBlocked: boolean | null): RunReportView['ads'] {
  if (adsBlocked !== false) return null;
  return {
    title: 'Werbung nicht blockiert',
    message:
      'Dieser Durchlauf hat Anzeigen geladen wie ein echter Besucher. Sie zählen beim Werbenetzwerk als Impressionen.',
  };
}

/** "Werbung blockiert (12 Anfragen)", or null when there was nothing to block. */
function blockedAds(adsBlocked: boolean | null, requests: number | null): string | null {
  if (!adsBlocked || !requests) return null;
  return `Werbung blockiert (${plural(requests, 'Anfrage', 'Anfragen')})`;
}

function liveHint(status: RunReport['run']['status'], workerOnline: boolean): string | null {
  if (status === 'running') return 'Läuft gerade. Der Report aktualisiert sich selbst.';
  if (status !== 'queued') return null;
  return workerOnline
    ? 'Wartet auf das Testsystem. Der Report aktualisiert sich selbst.'
    : 'Das Testsystem ist nicht verbunden. Der Durchlauf startet, sobald er wieder läuft.';
}

/** Screen 03: one run with its steps, timing and, if it failed, where and why. */
export function toRunReportView(
  report: RunReport,
  { workerOnline = true }: { workerOnline?: boolean } = {},
): RunReportView {
  const { run, job } = report;
  const steps = stepViews(report);
  const failed = report.steps.find((step) => step.status === 'failed');
  const succeeded = report.steps.filter(
    (step) => step.status === 'passed' || step.status === 'healed',
  ).length;
  const durationMs =
    run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;
  const duration = durationMs === null ? null : formatDuration(durationMs);
  const startedOrPlanned = run.startedAt ?? run.scheduledAt;

  const stats: StatCardView[] = [
    { label: 'Schritte', value: `${succeeded} / ${steps.length}`, hint: stepsHint(report, failed) },
    {
      label: 'Dauer',
      value: duration ?? DASH,
      hint:
        report.averageDurationMs === null
          ? 'noch kein Vergleich'
          : `Ø ${formatDuration(report.averageDurationMs)} bei diesem Test`,
    },
    {
      label: 'Start',
      value: run.startedAt ? formatClock(run.startedAt) : DASH,
      hint: startHint(run.scheduledAt, run.startedAt),
    },
    {
      label: 'Gerät',
      value: deviceLabel(run.device),
      hint: `Browser ${run.botNr} · ${browserLabel(run.browser)}`,
    },
  ];

  return {
    jobName: job.name,
    jobHref: `/jobs/${job.id}`,
    runLabel: `Durchlauf ${run.runNr}`,
    title: runTitle(run.runNr, run.slotIndex, job.runsPlanned),
    status: RUN_BADGE[run.status],
    meta: [
      formatDateLong(startedOrPlanned),
      `${formatClock(startedOrPlanned)} Uhr`,
      run.slotIndex === null ? 'manuell gestartet' : 'ausgelöst durch Zeitplan',
      blockedAds(run.adsBlocked, run.blockedAdRequests),
    ]
      .filter(Boolean)
      .join(' · '),
    stats,
    stepsSummary: [plural(steps.length, 'Schritt', 'Schritte'), duration]
      .filter(Boolean)
      .join(' · '),
    steps,
    failure:
      run.status === 'failed' && run.error
        ? {
            title: failed
              ? `Schritt ${failed.stepIndex + 1} fehlgeschlagen`
              : 'Durchlauf fehlgeschlagen',
            message: run.error,
          }
        : null,
    live: liveHint(run.status, workerOnline),
    marking: markingNote(run.analyticsMarking),
    ads: adsNote(run.adsBlocked),
    wave:
      report.waveSize > 1
        ? {
            href: `/laeufe/welle/${run.id}`,
            label: `Alle ${report.waveSize} Durchläufe dieses Starts`,
          }
        : null,
    screenshots: screenshotViews(report, steps),
  };
}
