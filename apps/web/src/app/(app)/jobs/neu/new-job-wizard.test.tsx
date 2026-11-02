import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftSaveResult, DraftTestRunResult } from '@/app/actions';
import { emptyDraft, newStep, type Issue, type WizardDraft } from '@/lib/job-draft';
import type { StartRecordingAction, TestRunView, WatchRunAction } from '@/lib/views';
import type { WizardState } from '@/lib/wizard-state';
import { NewJobWizard, type NewJobWizardProps } from './new-job-wizard';
import { chooseOption } from '../../../../../test/select';

// 13:30 in Berlin. Only Date is faked, so user-event's timers keep working.
const NOW = '2026-11-05T12:30:00.000Z';
const campaigns = [
  { id: 'k1', name: 'Allgemein' },
  { id: 'k2', name: 'Black Friday' },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
});

afterEach(() => {
  vi.useRealTimers();
});

type CreateAction = (draft: WizardDraft, draftId: string | null) => Promise<{ issues: Issue[] }>;

const noRecording: StartRecordingAction = async () => ({ ok: false, message: 'nicht im Test' });

/** A template that leaves opening the start page to the job. */
const contactTemplate = {
  view: {
    id: 'v1',
    name: 'Kontaktformular',
    description: 'Sendet das Formular ab.',
    href: '/vorlagen/v1',
    meta: '1 Schritt',
    steps: [{ typeLabel: 'Klicken', tone: 'primary' as const, title: 'Klicke', detail: '' }],
  },
  flow: {
    version: 1 as const,
    steps: [
      {
        id: 'senden',
        type: 'click' as const,
        target: { by: 'role' as const, role: 'button', name: 'Absenden' },
        timeoutMs: 10_000,
        aiFallback: true,
      },
    ],
  },
};

function renderWizard(
  createAction = vi.fn<CreateAction>(async () => ({ issues: [] })),
  overrides: Partial<NewJobWizardProps> = {},
) {
  render(
    <NewJobWizard
      campaigns={campaigns}
      now={NOW}
      createAction={createAction}
      saveDraft={async (draftId) => ({ draftId, savedAt: null })}
      startTestRun={async (draftId) => ({ issues: [], draftId })}
      testRunStatus={async () => null}
      watchRun={async () => ({ ok: false, message: 'nicht im Test' })}
      deleteAction={async () => ({})}
      startRecording={noRecording}
      templates={[contactTemplate]}
      aiReady
      workerOnline
      defaultCampaignId="k1"
      {...overrides}
    />,
  );
  return createAction;
}

/** Stands in for the connection to the worker's live browser. */
class FakeLiveSocket {
  static OPEN = 1;
  static last: FakeLiveSocket | null = null;
  readyState = 1;
  sent: unknown[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeLiveSocket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  receive(message: unknown) {
    act(() => this.onmessage?.({ data: JSON.stringify(message) }));
  }
}

const weiter = () => screen.getByRole('button', { name: 'Weiter' });
const summary = () => within(screen.getByRole('region', { name: 'Zusammenfassung' }));
const subtitle = () => screen.getByText(/^Schritt \d von 3/);

function fillStartUrl() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Adresse der Website' }), {
    target: { value: '127.0.0.1:4100/kontakt.html' },
  });
}

/** A free test with a goal: the quickest complete first step. */
async function describeFreeTest(
  user: ReturnType<typeof userEvent.setup>,
  goal = 'Es gibt ein Formular.',
) {
  fillStartUrl();
  await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' }), {
    target: { value: goal },
  });
}

async function takeTemplate(user: ReturnType<typeof userEvent.setup>) {
  fillStartUrl();
  await user.click(screen.getByRole('button', { name: /Aus Vorlage übernehmen/ }));
  await user.click(screen.getByRole('button', { name: 'Schritte übernehmen' }));
}

async function confirmApproval(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /Test freigegeben/ }));
}

describe('NewJobWizard', () => {
  it('starts with the website and the way to test, a fixed flow by default', () => {
    renderWizard();
    expect(subtitle()).toHaveTextContent(
      'Schritt 1 von 3 · Welche Website, und was soll geprüft werden?',
    );
    expect(screen.getByRole('textbox', { name: 'Adresse der Website' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Fester Ablauf/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Aufnahme starten' })).toBeVisible();
    // Name and campaign come last, not first.
    expect(screen.queryByRole('textbox', { name: 'Name des Tests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Kampagne' })).not.toBeInTheDocument();
  });

  it('records steps in the live browser and takes them over', async () => {
    vi.stubGlobal('WebSocket', FakeLiveSocket);
    const user = userEvent.setup();
    const startRecording = vi.fn<StartRecordingAction>(async () => ({
      ok: true,
      url: 'ws://localhost:4200/live?token=t',
    }));
    renderWizard(undefined, { startRecording });
    fillStartUrl();

    await user.click(screen.getByRole('button', { name: 'Aufnahme starten' }));
    expect(startRecording).toHaveBeenCalledWith('127.0.0.1:4100/kontakt.html');
    const socket = FakeLiveSocket.last as FakeLiveSocket;
    expect(socket.url).toBe('ws://localhost:4200/live?token=t');

    const url = 'https://127.0.0.1:4100/kontakt.html';
    socket.receive({ type: 'ready', viewport: { width: 1280, height: 800 }, url });
    socket.receive({ type: 'step', step: { type: 'open', url } });
    socket.receive({
      type: 'step',
      step: { type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
    });
    expect(screen.getByRole('textbox', { name: 'Adresse' })).toHaveValue(url);

    await user.click(screen.getByRole('button', { name: 'Bildschirmfoto aufnehmen' }));
    expect(socket.sent).toEqual([{ type: 'screenshot' }]);

    await user.click(
      screen.getByRole('button', { name: 'Aufnahme beenden · 2 Schritte übernehmen' }),
    );
    expect(socket.readyState).toBe(3);
    expect(screen.getByRole('button', { name: 'Schritt 2: Klicke auf „Absenden“' })).toBeVisible();
    // Recorded steps are corrected, not built: no adding, but recording again.
    expect(screen.queryByRole('button', { name: 'Schritt hinzufügen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu aufnehmen' })).toBeVisible();
    vi.unstubAllGlobals();
  });

  it('says why the live browser does not start', async () => {
    const user = userEvent.setup();
    renderWizard(undefined, {
      startRecording: async () => ({
        ok: false,
        message: 'Das Testsystem ist nicht verbunden. Ohne es gibt es keinen Live-Browser.',
      }),
    });
    fillStartUrl();
    await user.click(screen.getByRole('button', { name: 'Aufnahme starten' }));
    expect(await screen.findByText(/Das Testsystem ist nicht verbunden/)).toBeVisible();
  });

  it('tells before recording that the worker is not connected', () => {
    renderWizard(undefined, { workerOnline: false });
    expect(screen.getByText('Das Testsystem ist gerade nicht verbunden')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aufnahme starten' })).toBeDisabled();
  });

  it('tests freely: only the goal, which the AI checks in every run', async () => {
    const user = userEvent.setup();
    const createAction = renderWizard();

    fillStartUrl();
    await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
    expect(screen.queryByRole('region', { name: 'Ablauf' })).not.toBeInTheDocument();
    const goal = screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' });
    await user.click(weiter());
    expect(goal).toHaveAccessibleDescription(/Bitte ausfüllen/);

    fireEvent.change(goal, { target: { value: 'Es gibt einen blauen Newsletter-Button.' } });
    await user.click(weiter());
    await user.click(weiter());
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));
    expect(createAction.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'k1',
      steps: [
        { type: 'open', url: 'https://127.0.0.1:4100/kontakt.html' },
        { type: 'ai', value: 'Es gibt einen blauen Newsletter-Button.' },
      ],
    });
  });

  it('warns in a free test while no AI provider is set up', async () => {
    const user = userEvent.setup();
    renderWizard(undefined, { aiReady: false });
    await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
    expect(screen.getByText('Noch kein KI-Anbieter eingerichtet')).toBeVisible();
  });

  it('keeps the steps of each mode while the other one is shown', async () => {
    const user = userEvent.setup();
    renderWizard();
    await takeTemplate(user);

    await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' }), {
      target: { value: 'Ein Ziel.' },
    });
    await user.click(screen.getByRole('button', { name: /Fester Ablauf/ }));
    expect(screen.getByRole('button', { name: 'Schritt 2: Klicke auf „Absenden“' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
    expect(screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' })).toHaveValue(
      'Ein Ziel.',
    );
  });

  it('takes over the steps of a template, after opening the start page', async () => {
    const user = userEvent.setup();
    renderWizard();
    await takeTemplate(user);
    expect(
      screen.getByRole('button', { name: 'Schritt 1: Öffne 127.0.0.1:4100/kontakt.html' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Schritt 2: Klicke auf „Absenden“' })).toBeVisible();
  });

  it('suggests a name from the goal, and the campaign of the project is set already', async () => {
    const user = userEvent.setup();
    renderWizard();
    await describeFreeTest(user, 'Das Kontaktformular lässt sich abschicken. Danach kommt Dank.');
    await user.click(weiter());
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 3 von 3');
    expect(screen.getByRole('textbox', { name: 'Name des Tests' })).toHaveValue(
      'Das Kontaktformular lässt sich abschicken',
    );
    expect(screen.getByRole('combobox', { name: 'Kampagne' })).toHaveTextContent('Allgemein');
    expect(summary().getByText('Das Kontaktformular lässt sich abschicken')).toBeInTheDocument();
  });

  it('hides the campaign when the project has only one', async () => {
    const user = userEvent.setup();
    renderWizard(undefined, { campaigns: [campaigns[0] as { id: string; name: string }] });
    await describeFreeTest(user);
    await user.click(weiter());
    await user.click(weiter());
    expect(screen.queryByRole('combobox', { name: 'Kampagne' })).not.toBeInTheDocument();
    expect(summary().queryByText('Kampagne')).not.toBeInTheDocument();
  });

  it('keeps the technical settings folded away, and shows when they were changed', async () => {
    const user = userEvent.setup();
    const createAction = renderWizard();
    await describeFreeTest(user);
    await user.click(weiter());
    await user.click(weiter());

    const advanced = screen.getByRole('button', { name: 'Erweiterte Einstellungen' });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(advanced).toHaveAccessibleDescription('GA4-Markierung an · Werbung blockiert');
    expect(screen.queryByText('Geändert')).not.toBeInTheDocument();

    await user.click(advanced);
    await user.click(screen.getByRole('switch', { name: /Werbung blockieren/ }));
    expect(advanced).toHaveAccessibleDescription(/Werbung erlaubt.*Geändert/);
    expect(summary().getByText('Werbung erlaubt')).toBeInTheDocument();

    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));
    expect(createAction.mock.calls[0]?.[0]).toMatchObject({ blockAds: false });
  });

  it('stays on the first step and names the missing website and flow', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(weiter());

    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die markierten Angaben prüfen.');
    expect(subtitle()).toHaveTextContent('Schritt 1 von 3');
    expect(screen.getByRole('textbox', { name: 'Adresse der Website' })).toBeInvalid();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // Clicks through all three steps; with coverage instrumentation that takes longer than 5 s.
  it('walks through all three steps and saves the job', { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    const createAction = renderWizard();

    await describeFreeTest(user, 'Das Kontaktformular lässt sich abschicken.');
    expect(summary().getByText('127.0.0.1:4100/kontakt.html')).toBeInTheDocument();
    expect(summary().getByText('Frei mit KI')).toBeInTheDocument();
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 2 von 3 · Wann soll der Test laufen?');
    await chooseOption(user, screen.getByRole('combobox', { name: 'Wie oft?' }), 'Eigener Abstand');
    fireEvent.change(screen.getByRole('textbox', { name: 'Abstand in Minuten' }), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Wie oft insgesamt?' }), {
      target: { value: '4' },
    });
    expect(summary().getByText('alle 15 Min. · 4-mal')).toBeInTheDocument();
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 3 von 3');
    await user.click(screen.getByRole('button', { name: /iPhone 15/ }));
    expect(summary().getByText('Desktop (Chrome), iPhone 15 (Safari)')).toBeInTheDocument();
    expect(screen.getByText(/4 Starts × 2 Geräte = 8 Durchläufe/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: 'Kontaktformular-Test' },
    });
    await chooseOption(user, screen.getByRole('combobox', { name: 'Kampagne' }), 'Black Friday');

    // The confirmation that the website may be tested comes right before creating the job.
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));
    expect(createAction).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Bitte bestätigen, dass ihr diese Website testen dürft.',
    );
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));

    expect(createAction).toHaveBeenCalledOnce();
    expect(createAction.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'k2',
      name: 'Kontaktformular-Test',
      devices: ['desktop', 'iphone'],
      schedule: { type: 'interval', everyMinutes: '15', maxRuns: '4' },
      steps: [
        { type: 'open', url: 'https://127.0.0.1:4100/kontakt.html' },
        { type: 'ai', value: 'Das Kontaktformular lässt sich abschicken.' },
      ],
    });
  });

  it('goes back with "Zurück" and through the finished steps above', async () => {
    const user = userEvent.setup();
    renderWizard();
    await describeFreeTest(user);
    await user.click(weiter());
    expect(subtitle()).toHaveTextContent('Schritt 2 von 3');

    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(subtitle()).toHaveTextContent('Schritt 1 von 3');
    await user.click(weiter());
    await user.click(screen.getByRole('button', { name: '1 · Website & Test (erledigt)' }));
    expect(screen.getByRole('textbox', { name: 'Adresse der Website' })).toHaveValue(
      '127.0.0.1:4100/kontakt.html',
    );
    expect(screen.getByRole('link', { name: 'Abbrechen' })).toHaveAttribute('href', '/');
  });

  it('marks an invalid flow step and opens it for editing', async () => {
    const user = userEvent.setup();
    renderWizard();
    await takeTemplate(user);

    await user.click(screen.getByRole('button', { name: /^Schritt 2:/ }));
    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Element finden über' }),
      'Label',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /^Schritt 1:/ }));
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 1 von 3');
    expect(screen.getByRole('region', { name: 'Schritt 2 bearbeiten' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveAccessibleDescription(
      'Bitte ausfüllen.',
    );
  });

  it('reorders and removes steps, keeping the selection on the moved step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await takeTemplate(user);
    await user.click(screen.getByRole('button', { name: /^Schritt 2:/ }));

    await user.click(screen.getByRole('button', { name: 'Schritt 2 nach oben' }));
    expect(screen.getByRole('button', { name: /^Schritt 1: Klicke/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Schritt 1 löschen' }));
    expect(screen.getByRole('button', { name: /^Schritt 1: Öffne/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Schritt 1 löschen' }));
    expect(screen.queryByRole('region', { name: /bearbeiten/ })).not.toBeInTheDocument();
    await user.click(weiter());
    expect(screen.getByText('Der Ablauf braucht mindestens einen Schritt.')).toBeVisible();
  });

  it('keeps at least one device', async () => {
    const user = userEvent.setup();
    renderWizard();
    await describeFreeTest(user);
    await user.click(weiter());
    await user.click(weiter());

    await user.click(screen.getByRole('button', { name: /Desktop/ }));
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));

    expect(screen.getByText('Mindestens ein Gerät wählen.')).toBeVisible();
  });

  it('shows problems the server found at their step', async () => {
    const user = userEvent.setup();
    renderWizard(
      vi.fn<CreateAction>(async () => ({
        issues: [
          { path: 'schedule.slots.0.time', message: 'Der Termin liegt in der Vergangenheit.' },
        ],
      })),
    );
    await describeFreeTest(user);
    await user.click(weiter());
    await user.click(screen.getByRole('radio', { name: 'Feste Zeiten' }));
    await user.click(weiter());
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));

    expect(subtitle()).toHaveTextContent('Schritt 2 von 3');
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveAccessibleDescription(
      'Der Termin liegt in der Vergangenheit.',
    );
  });
});

type SaveDraft = (draftId: string | null, state: WizardState) => Promise<DraftSaveResult>;
type StartTestRun = (draftId: string | null, state: WizardState) => Promise<DraftTestRunResult>;

const waiting: TestRunView = {
  runId: 'run-1',
  href: '/laeufe/run-1',
  status: { tone: 'neutral', label: 'Wartet' },
  open: true,
  where: 'Desktop · Chrome',
  message: 'Wartet auf einen freien Browser.',
  failedIndex: null,
  failedStep: null,
  reason: null,
};

const failedRun: TestRunView = {
  ...waiting,
  status: { tone: 'danger', label: 'Fehlgeschlagen' },
  open: false,
  message: 'Fehlgeschlagen bei Schritt 2.',
  failedIndex: 1,
  failedStep: 'Schritt 2 · Klicke auf „Absenden“',
  reason: 'Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).',
};

describe('NewJobWizard – draft and test run', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('saves the flow as a draft as soon as there is one, and shows it in the address', async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn<SaveDraft>(async () => ({ draftId: 'd1', savedAt: NOW }));
    renderWizard(undefined, { saveDraft });
    expect(screen.getByText(/Sobald es einen Ablauf gibt/)).toBeInTheDocument();

    await takeTemplate(user);
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    // An address alone is no draft yet: every save has the flow.
    expect(saveDraft.mock.calls.every(([, state]) => state.draft.steps.length === 2)).toBe(true);
    expect(saveDraft.mock.calls[0]?.[0]).toBeNull();
    expect(window.location.search).toBe('?entwurf=d1');
    expect(screen.getByText(/Als Entwurf gespeichert um 13:30:00/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
    await waitFor(() => expect(saveDraft.mock.lastCall?.[1].method).toBe('free'));
    expect(saveDraft.mock.lastCall?.[0]).toBe('d1');
  });

  it('continues a stored draft where it was left, with its last test run', () => {
    const open = newStep('open', [], 'https://beispiel.de');
    const state: WizardState = {
      version: 1,
      draft: {
        ...emptyDraft(new Date(NOW)),
        campaignId: 'k1',
        startUrl: 'beispiel.de',
        steps: [open],
      },
      method: 'fixed',
      goal: '',
      fixedSteps: [],
      current: 0,
    };
    renderWizard(undefined, {
      initial: { draftId: 'd1', savedAt: NOW, state, testRun: failedRun },
    });

    expect(screen.getByRole('textbox', { name: 'Adresse der Website' })).toHaveValue('beispiel.de');
    expect(screen.getByRole('button', { name: 'Schritt 1: Öffne beispiel.de' })).toBeVisible();
    const testRun = within(screen.getByRole('region', { name: 'Testlauf' }));
    expect(testRun.getByRole('status')).toHaveTextContent('Schritt 2 · Klicke auf „Absenden“');
    expect(screen.getByRole('region', { name: 'Entwurf löschen' })).toBeInTheDocument();
    expect(screen.getByText(/Als Entwurf gespeichert um 13:30:00/)).toBeInTheDocument();
  });

  it('plays the flow once and follows the run until it is done', { timeout: 10_000 }, async () => {
    const user = userEvent.setup();
    const startTestRun = vi.fn<StartTestRun>(async () => ({
      issues: [],
      draftId: 'd1',
      run: waiting,
    }));
    const testRunStatus = vi.fn(async () => failedRun);
    renderWizard(undefined, { startTestRun, testRunStatus });
    await takeTemplate(user);

    const card = within(screen.getByRole('region', { name: 'Testlauf' }));
    expect(card.getByText(/einmal durch, auf Desktop in Chrome/)).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: 'Testlauf' }));

    expect(startTestRun).toHaveBeenCalledOnce();
    expect(startTestRun.mock.calls[0]?.[1].draft.steps).toHaveLength(2);
    expect(await card.findByRole('status')).toHaveTextContent('Wartet auf einen freien Browser.');
    expect(card.getByRole('button', { name: 'Erneut testen' })).toBeDisabled();
    expect(window.location.search).toBe('?entwurf=d1');

    await waitFor(() => expect(card.getByRole('status')).toHaveTextContent('Fehlgeschlagen'), {
      timeout: 5_000,
    });
    expect(testRunStatus).toHaveBeenCalledWith('run-1');
    expect(card.getByRole('button', { name: 'Erneut testen' })).toBeEnabled();
  });

  it('shows the test run live, step by step, and the result as soon as it ends', async () => {
    vi.stubGlobal('WebSocket', FakeLiveSocket);
    const user = userEvent.setup();
    const watchRun = vi.fn<WatchRunAction>(async () => ({
      ok: true,
      url: 'ws://localhost:4200/watch?token=t',
    }));
    const testRunStatus = vi.fn(async () => failedRun);
    renderWizard(undefined, {
      startTestRun: async () => ({ issues: [], draftId: 'd1', run: waiting }),
      testRunStatus,
      watchRun,
    });
    await takeTemplate(user);
    const card = within(screen.getByRole('region', { name: 'Testlauf' }));
    await user.click(card.getByRole('button', { name: 'Testlauf' }));

    await waitFor(() => expect(watchRun).toHaveBeenCalledWith('run-1'));
    await waitFor(() => expect(FakeLiveSocket.last?.url).toBe('ws://localhost:4200/watch?token=t'));
    const socket = FakeLiveSocket.last as FakeLiveSocket;
    expect(card.getByText('Verbinde mit dem Testsystem …')).toBeVisible();

    socket.receive({ type: 'frame', data: 'eA==' });
    socket.receive({ type: 'step', index: 1, total: 2, status: 'running' });
    expect(card.getByRole('img', { name: 'Live-Bild des Durchlaufs' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,eA==',
    );
    expect(card.getByText('Schritt 2 von 2 · Klicke auf „Absenden“')).toBeVisible();

    socket.receive({ type: 'ended', status: 'failed' });
    await waitFor(() => expect(card.getByRole('status')).toHaveTextContent('Fehlgeschlagen'));
    expect(testRunStatus).toHaveBeenCalledWith('run-1');
    expect(card.queryByRole('img')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows at the goal why the test run did not start, and a gone draft at the card', async () => {
    const user = userEvent.setup();
    const startTestRun = vi
      .fn<StartTestRun>()
      .mockResolvedValueOnce({
        issues: [{ path: 'flow.steps.1.value', message: 'Bitte das Ziel beschreiben.' }],
        draftId: null,
      })
      .mockResolvedValueOnce({
        issues: [{ path: 'job', message: 'Diesen Entwurf gibt es nicht mehr.' }],
        draftId: null,
      });
    renderWizard(undefined, { startTestRun });
    await describeFreeTest(user, '');
    const card = within(screen.getByRole('region', { name: 'Testlauf' }));

    await user.click(card.getByRole('button', { name: 'Testlauf' }));
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' }),
      ).toHaveAccessibleDescription(expect.stringContaining('Bitte das Ziel beschreiben.')),
    );

    // The button is busy until the first attempt has ended completely.
    await waitFor(() => expect(card.getByRole('button', { name: 'Testlauf' })).toBeEnabled());
    await user.click(card.getByRole('button', { name: 'Testlauf' }));
    expect(await card.findByRole('alert')).toHaveTextContent('Diesen Entwurf gibt es nicht mehr.');
  });

  it('turns the saved draft into the test', async () => {
    const user = userEvent.setup();
    const createAction = renderWizard(undefined, {
      saveDraft: async () => ({ draftId: 'd1', savedAt: NOW }),
    });
    await describeFreeTest(user);
    await waitFor(() => expect(window.location.search).toBe('?entwurf=d1'));
    await user.click(weiter());
    await user.click(weiter());
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));

    expect(createAction).toHaveBeenCalledOnce();
    expect(createAction.mock.calls[0]?.[1]).toBe('d1');
  });
});
