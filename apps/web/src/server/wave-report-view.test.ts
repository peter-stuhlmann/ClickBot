// @vitest-environment node
import type { WaveReport, WaveRun } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { toWaveReportView } from './wave-report-view';

// 16:17:00 in Berlin.
const scheduled = new Date('2026-11-01T15:17:00Z');
const seconds = (s: number) => new Date(scheduled.getTime() + s * 1000);

const base = { timeoutMs: 10_000, aiFallback: true };
const flow: WaveReport['flow'] = {
  version: 1,
  steps: [
    { ...base, id: 'open', type: 'open', url: 'https://beispiel.de' },
    {
      ...base,
      id: 'kurs',
      type: 'click',
      target: { by: 'role', role: 'link', name: 'Katalanisch lernen' },
    },
  ],
};

const NOT_FOUND = 'Element nicht gefunden: Rolle „link“ mit Name „Katalanisch lernen“ (nach 10 s).';

function run(overrides: Partial<WaveRun> & Pick<WaveRun, 'id' | 'device' | 'browser'>): WaveRun {
  return {
    runNr: 1,
    botNr: 1,
    status: 'passed',
    scheduledAt: scheduled,
    startedAt: seconds(1),
    finishedAt: seconds(9),
    error: null,
    failedStep: null,
    ...overrides,
  };
}

const failedAt = (id: string, device: WaveRun['device'], browser: WaveRun['browser']) =>
  run({
    id,
    device,
    browser,
    status: 'failed',
    finishedAt: seconds(22),
    error: NOT_FOUND,
    failedStep: { stepIndex: 1, stepId: 'kurs', message: NOT_FOUND },
  });

function report(runs: WaveRun[], manual = true): WaveReport {
  return {
    job: { id: 'job-1', name: 'Test auf beispiel.de' },
    flow,
    manual,
    scheduledAt: scheduled,
    runs,
  };
}

describe('toWaveReportView', () => {
  it('shows every device and browser with its result, and where and why it failed', () => {
    const view = toWaveReportView(
      report([
        run({ id: 'a', device: 'desktop', browser: 'chromium' }),
        failedAt('b', 'desktop', 'firefox'),
        failedAt('c', 'iphone', 'webkit'),
        run({ id: 'd', device: 'android', browser: 'chromium', status: 'warning' }),
      ]),
    );

    expect(view).toMatchObject({
      jobName: 'Test auf beispiel.de',
      jobHref: '/jobs/job-1',
      title: 'Start 16:17 Uhr',
      status: { tone: 'danger', label: 'Fehlgeschlagen' },
      meta: 'So., 01.11.2026 · manuell gestartet · 4 Durchläufe auf 3 Geräten',
      summary: '4 Durchläufe · 2 fehlgeschlagen',
      live: null,
    });
    expect(view.stats).toEqual([
      { label: 'Durchläufe', value: '2 / 4', hint: '2 fehlgeschlagen' },
      { label: 'Fehlgeschlagen', value: '2', hint: 'Desktop (Firefox), iPhone 15 (Safari)' },
      { label: 'Dauer', value: '21,0 s', hint: 'längster · Ø 14,5 s' },
      { label: 'Start', value: '16:17:01', hint: 'geplant 16:17:00' },
    ]);
    expect(view.rows.map((row) => [row.device, row.browser, row.status.label])).toEqual([
      ['Desktop', 'Chrome', 'Bestanden'],
      ['Desktop', 'Firefox', 'Fehlgeschlagen'],
      ['iPhone 15', 'Safari', 'Fehlgeschlagen'],
      ['Android (Pixel 8)', 'Chrome', 'Mit Hinweis'],
    ]);
    expect(view.rows[1]).toMatchObject({
      href: '/laeufe/b',
      failedStep: 'Schritt 2 · Klicke auf „Katalanisch lernen“',
      reason: NOT_FOUND,
      duration: '21,0 s',
      failed: true,
    });
    expect(view.rows[0]).toMatchObject({ failedStep: null, reason: null, duration: '8,0 s' });
    // The same failure on two browsers is one entry, naming both.
    expect(view.failures).toEqual([
      {
        title: 'Schritt 2 · Klicke auf „Katalanisch lernen“',
        where: 'Desktop (Firefox), iPhone 15 (Safari)',
        message: NOT_FOUND,
      },
    ]);
  });

  it('says what is still going on while runs wait or run', () => {
    const waiting = report([
      run({
        id: 'a',
        device: 'desktop',
        browser: 'chromium',
        status: 'queued',
        startedAt: null,
        finishedAt: null,
      }),
      run({
        id: 'b',
        device: 'iphone',
        browser: 'webkit',
        status: 'queued',
        startedAt: null,
        finishedAt: null,
      }),
    ]);
    expect(toWaveReportView(waiting, { workerOnline: true })).toMatchObject({
      title: 'Start 16:17 Uhr',
      status: { label: 'Geplant' },
      live: '2 Durchläufe warten auf das Testsystem. Der Report aktualisiert sich selbst.',
    });
    expect(toWaveReportView(waiting, { workerOnline: false }).live).toBe(
      'Das Testsystem ist nicht verbunden. Die Durchläufe starten, sobald es wieder läuft.',
    );
    expect(toWaveReportView(waiting).stats).toMatchObject([
      { value: '0 / 2', hint: '2 noch offen' },
      { value: '0', hint: 'kein Durchlauf' },
      { value: '–', hint: 'noch kein Durchlauf fertig' },
      { value: '–', hint: 'geplant 16:17:00' },
    ]);

    const running = report([
      run({ id: 'a', device: 'desktop', browser: 'chromium' }),
      run({ id: 'b', device: 'iphone', browser: 'webkit', status: 'running', finishedAt: null }),
    ]);
    expect(toWaveReportView(running)).toMatchObject({
      status: { label: 'Läuft' },
      live: '1 Durchlauf läuft noch. Der Report aktualisiert sich selbst.',
    });
    expect(toWaveReportView(running).rows[1]?.duration).toBe('–');
  });

  it('names a run that never reached a step by the error of the run', () => {
    const view = toWaveReportView(
      report(
        [
          run({
            id: 'a',
            device: 'desktop',
            browser: 'webkit',
            status: 'failed',
            error: 'Lauf konnte nicht ausgeführt werden: Browser abgestürzt.',
          }),
        ],
        false,
      ),
    );
    expect(view.meta).toContain('ausgelöst durch Zeitplan');
    expect(view.rows[0]).toMatchObject({
      failedStep: null,
      reason: 'Lauf konnte nicht ausgeführt werden: Browser abgestürzt.',
    });
    expect(view.failures).toEqual([
      {
        title: 'Durchlauf konnte nicht ausgeführt werden',
        where: 'Desktop (Safari)',
        message: 'Lauf konnte nicht ausgeführt werden: Browser abgestürzt.',
      },
    ]);
  });

  it('is successful only when every run passed, and keeps a hint or an abort visible', () => {
    const passed = report([run({ id: 'a', device: 'desktop', browser: 'chromium' })]);
    expect(toWaveReportView(passed)).toMatchObject({
      status: { tone: 'success', label: 'Bestanden' },
      summary: '1 Durchlauf',
    });
    expect(toWaveReportView(passed).stats[0]).toEqual({
      label: 'Durchläufe',
      value: '1 / 1',
      hint: 'alle bestanden',
    });
    const hinted = report([
      run({ id: 'a', device: 'desktop', browser: 'chromium' }),
      run({ id: 'b', device: 'iphone', browser: 'webkit', status: 'warning' }),
    ]);
    expect(toWaveReportView(hinted).status).toEqual({ tone: 'warning', label: 'Mit Hinweis' });
    const aborted = report([
      run({
        id: 'a',
        device: 'desktop',
        browser: 'chromium',
        status: 'cancelled',
        error: 'Abgebrochen.',
      }),
    ]);
    expect(toWaveReportView(aborted)).toMatchObject({
      status: { tone: 'neutral', label: 'Abgebrochen' },
      rows: [{ reason: 'Abgebrochen.' }],
    });
  });

  it('counts "nicht bestanden" and "fehlgeschlagen" apart; a broken flow weighs more', () => {
    const notPassed = (id: string, device: WaveRun['device'], browser: WaveRun['browser']) =>
      run({
        id,
        device,
        browser,
        status: 'not_passed',
        error: 'Nicht erfüllt: Der Preis stimmt nicht.',
        failedStep: {
          stepIndex: 1,
          stepId: 'kurs',
          message: 'Nicht erfüllt: Der Preis stimmt nicht.',
        },
      });
    const onlyNotPassed = toWaveReportView(
      report([
        run({ id: 'a', device: 'desktop', browser: 'chromium' }),
        notPassed('b', 'desktop', 'firefox'),
      ]),
    );
    expect(onlyNotPassed.status).toEqual({ tone: 'danger', label: 'Nicht bestanden' });
    expect(onlyNotPassed.summary).toBe('2 Durchläufe · 1 nicht bestanden');
    expect(onlyNotPassed.stats[0]).toMatchObject({ value: '1 / 2', hint: '1 nicht bestanden' });
    expect(onlyNotPassed.rows[1]).toMatchObject({
      status: { label: 'Nicht bestanden' },
      failed: true,
      reason: 'Nicht erfüllt: Der Preis stimmt nicht.',
    });
    expect(onlyNotPassed.failures).toHaveLength(1);

    const both = toWaveReportView(
      report([notPassed('a', 'desktop', 'chromium'), failedAt('b', 'iphone', 'webkit')]),
    );
    expect(both.status).toEqual({ tone: 'danger', label: 'Fehlgeschlagen' });
    expect(both.summary).toBe('2 Durchläufe · 1 nicht bestanden · 1 fehlgeschlagen');
  });
});
