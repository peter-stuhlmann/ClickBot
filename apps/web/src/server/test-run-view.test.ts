// @vitest-environment node
import type { RunReport, RunStepRow } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { toTestRunView } from './test-run-view';

const scheduled = new Date('2026-11-02T15:17:00Z');
const seconds = (s: number) => new Date(scheduled.getTime() + s * 1000);

const base = { timeoutMs: 10_000, aiFallback: true };
const flow: RunReport['job']['flow'] = {
  version: 1,
  steps: [
    { ...base, id: 'open', type: 'open', url: 'https://beispiel.de' },
    { ...base, id: 'kurs', type: 'click', target: { by: 'role', role: 'link', name: 'Kurse' } },
  ],
};

const NOT_FOUND = 'Element nicht gefunden: Rolle „link“ mit Name „Kurse“ (nach 10 s).';

const stepRow = (
  stepIndex: number,
  stepId: string,
  status: RunStepRow['status'],
  message: string | null = null,
): RunStepRow => ({
  stepIndex,
  stepId,
  status,
  durationMs: 500,
  message,
  screenshotPath: null,
  aiActions: null,
  aiVerdict: null,
});

function report(run: Partial<RunReport['run']>, steps: RunStepRow[] = []): RunReport {
  return {
    waveSize: 1,
    run: {
      id: 'run-1',
      jobId: 'job-1',
      runNr: 1,
      slotIndex: null,
      botNr: 1,
      device: 'desktop',
      browser: 'chromium',
      locationProfileId: null,
      proxyId: null,
      status: 'queued',
      scheduledAt: scheduled,
      startedAt: null,
      finishedAt: null,
      error: null,
      analyticsMarking: { debugMode: true, internalTraffic: true, botFlag: true, runNumber: true },
      adsBlocked: true,
      blockedAdRequests: 0,
      videoPath: null,
      videoCues: null,
      createdAt: scheduled,
      ...run,
    },
    job: { id: 'job-1', name: 'Kurse', startUrl: 'https://beispiel.de', flow, runsPlanned: 1 },
    steps,
    averageDurationMs: null,
  };
}

describe('toTestRunView', () => {
  it('says that the run waits, and why when the worker is not there', () => {
    expect(toTestRunView(report({}), { workerOnline: true })).toEqual({
      runId: 'run-1',
      href: '/laeufe/run-1',
      status: { tone: 'neutral', label: 'Wartet' },
      open: true,
      where: 'Desktop · Chrome',
      message: 'Wartet auf einen freien Browser.',
      failedIndex: null,
      failedStep: null,
      reason: null,
      video: null,
    });
    expect(toTestRunView(report({}), { workerOnline: false }).message).toBe(
      'Das Testsystem ist nicht verbunden. Der Testlauf startet, sobald es läuft.',
    );
  });

  it('follows the run while it runs', () => {
    expect(toTestRunView(report({ status: 'running', startedAt: seconds(1) }))).toMatchObject({
      status: { label: 'Läuft' },
      open: true,
      message: 'Läuft gerade …',
    });
  });

  it('counts the passed steps of a successful run', () => {
    const view = toTestRunView(
      report({ status: 'passed', startedAt: seconds(1), finishedAt: seconds(5) }, [
        stepRow(0, 'open', 'passed'),
        stepRow(1, 'kurs', 'passed'),
      ]),
    );
    expect(view).toMatchObject({
      status: { tone: 'success', label: 'Bestanden' },
      open: false,
      message: 'Alle 2 Schritte bestanden, in 4,0 s.',
    });
  });

  it('names the failed step, its place in the flow and the reason', () => {
    const view = toTestRunView(
      report(
        { status: 'failed', startedAt: seconds(1), finishedAt: seconds(12), error: NOT_FOUND },
        [stepRow(0, 'open', 'passed'), stepRow(1, 'kurs', 'failed', NOT_FOUND)],
      ),
    );
    expect(view).toMatchObject({
      status: { tone: 'danger', label: 'Fehlgeschlagen' },
      open: false,
      message: 'Fehlgeschlagen: Der Ablauf bricht bei Schritt 2 ab.',
      failedIndex: 1,
      failedStep: 'Schritt 2 · Klicke auf „Kurse“',
      reason: NOT_FOUND,
    });
  });

  it('tells "Nicht bestanden" (the flow ran, the expectation is not met) from "Fehlgeschlagen"', () => {
    const reason =
      'Nicht erfüllt: Der Ab-Preis beträgt 1.999,00 €. Auf der Seite steht 2.009,00 €.';
    const view = toTestRunView(
      report(
        { status: 'not_passed', startedAt: seconds(1), finishedAt: seconds(12), error: reason },
        [stepRow(0, 'open', 'passed'), stepRow(1, 'kurs', 'failed', reason)],
      ),
    );
    expect(view).toMatchObject({
      status: { tone: 'danger', label: 'Nicht bestanden' },
      open: false,
      message:
        'Nicht bestanden: Der Ablauf lief durch, aber die Erwartung bei Schritt 2 ist nicht erfüllt.',
      failedIndex: 1,
      reason,
    });
    expect(view.message).not.toContain('Fehlgeschlagen');
  });

  it('gives the error of a run that never reached a step', () => {
    const error = 'Lauf konnte nicht ausgeführt werden: Browser abgestürzt.';
    expect(toTestRunView(report({ status: 'failed', error }))).toMatchObject({
      message: 'Fehlgeschlagen: Der Testlauf konnte nicht ausgeführt werden.',
      failedIndex: null,
      reason: error,
    });
    expect(toTestRunView(report({ status: 'cancelled', error: 'Abgebrochen.' }))).toMatchObject({
      status: { label: 'Abgebrochen' },
      message: 'Der Testlauf wurde abgebrochen.',
      reason: 'Abgebrochen.',
    });
  });

  it('offers the video of the run once it is there', () => {
    const view = toTestRunView(
      report({
        status: 'passed',
        videoPath: 'runs/run-1/video.mp4',
        videoCues: [],
      }),
    );
    expect(view.video).toEqual({
      url: '/artifacts/runs/run-1/video.mp4',
      captionsUrl: '/laeufe/run-1/untertitel',
      fileName: 'kurse-durchlauf-1.mp4',
    });
    expect(toTestRunView(report({ status: 'running' })).video).toBeNull();
  });

  it('points to the report for a hint', () => {
    expect(
      toTestRunView(report({ status: 'warning', startedAt: seconds(1), finishedAt: seconds(3) })),
    ).toMatchObject({
      status: { tone: 'warning', label: 'Mit Hinweis' },
      message: 'Durchgelaufen, mit Hinweis. Was nicht prüfbar war, steht im Report.',
    });
  });
});
