import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue, WizardDraft } from '@/lib/job-draft';
import type { StartRecordingAction } from '@/lib/views';
import { NewJobWizard, type NewJobWizardProps } from './new-job-wizard';
import { chooseOption } from '../../../../test/select';

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

type CreateAction = (draft: WizardDraft) => Promise<{ issues: Issue[] }>;

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
    fireEvent.change(screen.getByRole('textbox', { name: 'Alle (Minuten)' }), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Max. Durchläufe' }), {
      target: { value: '4' },
    });
    expect(summary().getByText('alle 15 Min. · max. 4 Durchläufe')).toBeInTheDocument();
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
    await user.click(screen.getByRole('radio', { name: 'Termine' }));
    await user.click(weiter());
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Test anlegen' }));

    expect(subtitle()).toHaveTextContent('Schritt 2 von 3');
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveAccessibleDescription(
      'Der Termin liegt in der Vergangenheit.',
    );
  });
});
