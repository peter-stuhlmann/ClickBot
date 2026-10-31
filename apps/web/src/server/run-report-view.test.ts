// @vitest-environment node
import type { RunReport, RunStepRow } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { toRunReportView } from './run-report-view';

// 14:30:00 in Berlin.
const scheduled = new Date('2026-11-05T13:30:00Z');
const seconds = (s: number) => new Date(scheduled.getTime() + s * 1000);

const base = { timeoutMs: 10_000, aiFallback: true };
const flow: RunReport['job']['flow'] = {
  version: 1,
  steps: [
    { ...base, id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' },
    {
      ...base,
      id: 'send',
      type: 'click',
      target: { by: 'role', role: 'button', name: 'Absenden' },
    },
    {
      ...base,
      id: 'thanks',
      type: 'assert',
      assertion: { kind: 'textVisible', text: 'Vielen Dank' },
    },
  ],
};

const SEND_ERROR = 'Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).';

function stepRow(
  stepIndex: number,
  stepId: string,
  status: RunStepRow['status'],
  durationMs: number,
  extra: Partial<RunStepRow> = {},
): RunStepRow {
  return {
    stepIndex,
    stepId,
    status,
    durationMs,
    message: null,
    screenshotPath: null,
    aiActions: null,
    aiVerdict: null,
    ...extra,
  };
}

const passedSteps = [
  stepRow(0, 'open', 'passed', 1_200),
  stepRow(1, 'send', 'passed', 600),
  stepRow(2, 'thanks', 'passed', 1_100),
];

const failedSteps = [
  stepRow(0, 'open', 'passed', 1_200),
  stepRow(1, 'send', 'failed', 10_004, {
    message: SEND_ERROR,
    screenshotPath: 'runs/run-1/1-send.png',
  }),
  stepRow(2, 'thanks', 'skipped', 0),
];

function report(
  overrides: {
    run?: Partial<RunReport['run']>;
    job?: Partial<RunReport['job']>;
    steps?: RunStepRow[];
    averageDurationMs?: number | null;
  } = {},
): RunReport {
  return {
    run: {
      id: 'run-1',
      jobId: 'job-1',
      runNr: 7,
      slotIndex: 6,
      botNr: 2,
      device: 'iphone',
      browser: 'webkit',
      locationProfileId: null,
      proxyId: null,
      status: 'passed',
      scheduledAt: scheduled,
      startedAt: seconds(1),
      finishedAt: seconds(9.4),
      error: null,
      analyticsMarking: { debugMode: true, internalTraffic: true, botFlag: true, runNumber: true },
      adsBlocked: true,
      blockedAdRequests: 0,
      createdAt: scheduled,
      ...overrides.run,
    },
    job: {
      id: 'job-1',
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de',
      flow,
      runsPlanned: 20,
      ...overrides.job,
    },
    steps: overrides.steps ?? passedSteps,
    averageDurationMs:
      overrides.averageDurationMs === undefined ? 3_900 : overrides.averageDurationMs,
  };
}

describe('toRunReportView', () => {
  it('describes a passed run like the design', () => {
    const view = toRunReportView(report(), { workerOnline: true });

    expect(view).toMatchObject({
      jobName: 'Kontaktformular-Test',
      jobHref: '/jobs/job-1',
      runLabel: 'Lauf #7',
      title: 'Lauf #7 von 20',
      status: { tone: 'success', label: 'Erfolgreich' },
      meta: 'Do., 05.11.2026 · 14:30:01 Uhr · ausgelöst durch Zeitplan',
      stepsSummary: '3 Schritte · 8,4 s',
      failure: null,
      screenshot: null,
    });
    expect(view.stats).toEqual([
      { label: 'Schritte', value: '3 / 3', hint: 'alle bestanden' },
      { label: 'Dauer', value: '8,4 s', hint: 'Ø 3,9 s bei diesem Job' },
      { label: 'Start', value: '14:30:01', hint: 'geplant 14:30:00 · 1 s später' },
      { label: 'Gerät', value: 'iPhone 15', hint: 'Bot #2 · Safari' },
    ]);
    expect(view.steps).toEqual([
      {
        number: 1,
        status: 'passed',
        title: 'Öffne beispiel.de/kontakt',
        detail: 'url = "https://beispiel.de/kontakt"',
        duration: '1,2 s',
        screenshotUrl: null,
      },
      {
        number: 2,
        status: 'passed',
        title: 'Klicke auf „Absenden“',
        detail: 'role = button, name = "Absenden"',
        duration: '0,6 s',
        screenshotUrl: null,
      },
      {
        number: 3,
        status: 'passed',
        title: 'Prüfe: „Vielen Dank“ ist sichtbar',
        detail: 'expect text "Vielen Dank"',
        duration: '1,1 s',
        screenshotUrl: null,
      },
    ]);
  });

  it('shows where a failed run stopped, with the message and the screenshot', () => {
    const view = toRunReportView(
      report({ run: { status: 'failed', error: SEND_ERROR }, steps: failedSteps }),
    );

    expect(view.status).toEqual({ tone: 'danger', label: 'Fehlgeschlagen' });
    expect(view.stats[0]).toEqual({
      label: 'Schritte',
      value: '1 / 3',
      hint: 'Abbruch bei Schritt 2',
    });
    expect(view.steps.map((step) => [step.status, step.duration])).toEqual([
      ['passed', '1,2 s'],
      ['failed', '10,0 s'],
      ['skipped', '–'],
    ]);
    expect(view.steps[1]).toMatchObject({
      detail: SEND_ERROR,
      screenshotUrl: '/artifacts/runs/run-1/1-send.png',
    });
    expect(view.failure).toEqual({ title: 'Schritt 2 fehlgeschlagen', message: SEND_ERROR });
    expect(view.screenshot).toEqual({
      url: '/artifacts/runs/run-1/1-send.png',
      caption: 'Bildschirmfoto · Schritt 2',
    });
  });

  it('lists the planned steps of a run that has not started yet', () => {
    const view = toRunReportView(
      report({ run: { status: 'queued', startedAt: null, finishedAt: null }, steps: [] }),
    );

    expect(view.status).toEqual({ tone: 'neutral', label: 'Geplant' });
    expect(view.meta).toBe('Do., 05.11.2026 · 14:30:00 Uhr · ausgelöst durch Zeitplan');
    expect(view.stepsSummary).toBe('3 Schritte');
    expect(view.steps.map((step) => [step.status, step.duration])).toEqual([
      ['pending', '–'],
      ['pending', '–'],
      ['pending', '–'],
    ]);
    expect(view.stats).toEqual([
      { label: 'Schritte', value: '0 / 3', hint: 'noch nicht gestartet' },
      { label: 'Dauer', value: '–', hint: 'Ø 3,9 s bei diesem Job' },
      { label: 'Start', value: '–', hint: 'geplant 14:30:00' },
      { label: 'Gerät', value: 'iPhone 15', hint: 'Bot #2 · Safari' },
    ]);
  });

  it('says that a running run is still running', () => {
    const view = toRunReportView(
      report({ run: { status: 'running', finishedAt: null }, steps: [], averageDurationMs: null }),
    );
    expect(view.stats[0]?.hint).toBe('läuft gerade');
    expect(view.stats[1]).toEqual({ label: 'Dauer', value: '–', hint: 'noch kein Vergleich' });
  });

  it('explains a run that failed before its first step', () => {
    const error = 'Lauf konnte nicht ausgeführt werden: Browser abgestürzt';
    const view = toRunReportView(report({ run: { status: 'failed', error }, steps: [] }));
    expect(view.stats[0]?.hint).toBe('keine Schritt-Ergebnisse');
    expect(view.failure).toEqual({ title: 'Lauf fehlgeschlagen', message: error });
  });

  it('marks a test run, which is not one of the planned runs', () => {
    const view = toRunReportView(
      report({ run: { slotIndex: null, runNr: 5, startedAt: scheduled } }),
    );
    expect(view.title).toBe('Lauf #5 · Testlauf');
    expect(view.meta).toContain('manuell gestartet');
    expect(view.stats[2]?.hint).toBe('geplant 14:30:00 · pünktlich');
  });

  it('leaves out the planned count for a run numbered beyond it', () => {
    expect(toRunReportView(report({ run: { runNr: 21 } })).title).toBe('Lauf #21');
  });

  it('names steps that are missing from the flow or have no form yet', () => {
    const view = toRunReportView(report({ steps: [stepRow(0, 'old-step', 'passed', 100)] }));
    expect(view.steps[0]).toMatchObject({ title: 'Schritt „old-step“', detail: '' });

    const withExtract = report({ steps: [] });
    withExtract.job.flow = {
      version: 1,
      steps: [
        {
          ...base,
          id: 'nr',
          type: 'extract',
          target: { by: 'testId', testId: 'nr' },
          saveAs: 'nr',
        },
      ],
    };
    expect(toRunReportView(withExtract).steps[0]).toMatchObject({
      title: 'Wert auslesen',
      detail: '',
    });
  });

  it('shows a step the AI had to help with as passed, with its note', () => {
    const view = toRunReportView(
      report({
        run: { status: 'warning' },
        steps: [stepRow(0, 'send', 'healed', 4_900, { message: 'KI hat „Jetzt senden“ gewählt' })],
      }),
    );
    expect(view.status).toEqual({ tone: 'warning', label: 'Mit Hinweis' });
    expect(view.steps[0]).toMatchObject({
      status: 'healed',
      detail: 'KI hat „Jetzt senden“ gewählt',
    });
    expect(view.stats[0]).toMatchObject({ value: '1 / 1', hint: 'alle bestanden' });
  });

  it.each([
    ['queued', true, 'Wartet auf den Worker. Der Report aktualisiert sich selbst.'],
    ['queued', false, 'Der Worker ist offline. Der Lauf startet, sobald er wieder läuft.'],
    ['running', true, 'Läuft gerade. Der Report aktualisiert sich selbst.'],
    ['passed', true, null],
  ] as const)('tells what a %s run is waiting for (worker online: %s)', (status, online, live) => {
    expect(toRunReportView(report({ run: { status } }), { workerOnline: online }).live).toBe(live);
  });

  describe('GA4 marking of the run', () => {
    it('says nothing when the run was marked completely', () => {
      expect(toRunReportView(report()).marking).toBeNull();
    });

    it('notes which markings were off, as the run recorded them', () => {
      const view = toRunReportView(
        report({
          run: {
            analyticsMarking: {
              debugMode: false,
              internalTraffic: false,
              botFlag: true,
              runNumber: true,
            },
          },
        }),
      );
      expect(view.marking).toEqual({
        title: 'GA4-Markierung eingeschränkt',
        message:
          'Aus: Debug-Modus, Interner Traffic. Die GA4-Ereignisse dieses Laufs können in den normalen Berichten erscheinen.',
      });
    });

    it('warns plainly when the run was not marked at all', () => {
      const view = toRunReportView(
        report({
          run: {
            analyticsMarking: {
              debugMode: false,
              internalTraffic: false,
              botFlag: false,
              runNumber: false,
            },
          },
        }),
      );
      expect(view.marking).toEqual({
        title: 'Ohne GA4-Markierung',
        message:
          'Dieser Lauf war in GA4 nicht als Bot erkennbar. Seine Ereignisse zählen dort wie echte Besuche.',
      });
    });

    it('says nothing for runs from before the marking was recorded', () => {
      expect(toRunReportView(report({ run: { analyticsMarking: null } })).marking).toBeNull();
    });
  });

  it('lists what the AI did in an AI step', () => {
    const actions = ['Klick auf Link „Impressum“: ok', 'Fertig: Die Telefonnummer steht da.'];
    const view = toRunReportView(
      report({
        job: {
          flow: {
            version: 1,
            steps: [
              {
                id: 'ki',
                type: 'ai',
                instruction: 'Prüf die Telefonnummer im Impressum.',
                timeoutMs: 10_000,
                aiFallback: true,
              },
            ],
          },
        },
        steps: [stepRow(0, 'ki', 'passed', 6_000, { aiActions: actions })],
      }),
    );
    expect(view.steps[0]).toMatchObject({
      title: 'Prüf die Telefonnummer im Impressum.',
      aiActions: actions,
    });
  });

  it('shows the verdict of the AI per sub-goal, and counts an unclear step as not passed', () => {
    const verdict = [
      { goal: 'Es gibt einen blauen Button.', status: 'met' as const, evidence: 'Oben rechts.' },
      { goal: 'Die Anmeldung kommt an.', status: 'unknown' as const, evidence: 'Captcha.' },
    ];
    const view = toRunReportView(
      report({
        run: { status: 'warning' },
        job: {
          flow: {
            version: 1,
            steps: [
              {
                id: 'ziel',
                type: 'ai',
                instruction: 'Newsletter-Anmeldung funktioniert.',
                timeoutMs: 10_000,
                aiFallback: true,
              },
            ],
          },
        },
        steps: [
          stepRow(0, 'ziel', 'unclear', 20_000, {
            message: 'Nicht prüfbar: Die Anmeldung kommt an. Captcha.',
            aiVerdict: verdict,
          }),
        ],
      }),
    );
    expect(view.steps[0]).toMatchObject({
      status: 'unclear',
      detail: 'Nicht prüfbar: Die Anmeldung kommt an. Captcha.',
      aiVerdict: verdict,
    });
    expect(view.stats[0]).toEqual({
      label: 'Schritte',
      value: '0 / 1',
      hint: '1 nicht ganz prüfbar',
    });
  });

  describe('ads of the run', () => {
    it('says how many ad requests the run blocked, next to when it ran', () => {
      const view = toRunReportView(report({ run: { blockedAdRequests: 12 } }));
      expect(view.meta).toMatch(/ · Werbung blockiert \(12 Anfragen\)$/);
      expect(view.ads).toBeNull();
      expect(toRunReportView(report({ run: { blockedAdRequests: 1 } })).meta).toMatch(
        /\(1 Anfrage\)$/,
      );
    });

    it('says nothing when there was no ad to block, or for runs from before', () => {
      expect(toRunReportView(report()).meta).not.toMatch(/Werbung/);
      const before = toRunReportView(
        report({ run: { adsBlocked: null, blockedAdRequests: null } }),
      );
      expect(before.meta).not.toMatch(/Werbung/);
      expect(before.ads).toBeNull();
    });

    it('warns when the run loaded ads', () => {
      const view = toRunReportView(report({ run: { adsBlocked: false, blockedAdRequests: 0 } }));
      expect(view.ads).toEqual({
        title: 'Werbung nicht blockiert',
        message:
          'Dieser Lauf hat Anzeigen geladen wie ein echter Besucher. Sie zählen beim Werbenetzwerk als Impressionen.',
      });
    });
  });
});
