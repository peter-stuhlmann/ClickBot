import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newStep, type Issue, type WizardDraft } from '@/lib/job-draft';
import type { StartRecordingAction, SuggestFlowAction } from '@/lib/views';
import { NewJobWizard } from './new-job-wizard';
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

const noSuggestion: SuggestFlowAction = async () => ({ ok: false, message: 'nicht im Test' });
const noRecording: StartRecordingAction = async () => ({ ok: false, message: 'nicht im Test' });

function renderWizard(
  createAction = vi.fn<CreateAction>(async () => ({ issues: [] })),
  suggestAction: SuggestFlowAction = noSuggestion,
  startRecording: StartRecordingAction = noRecording,
) {
  render(
    <NewJobWizard
      campaigns={campaigns}
      now={NOW}
      createAction={createAction}
      suggestAction={suggestAction}
      startRecording={startRecording}
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
const subtitle = () => screen.getByText(/^Schritt \d von 4/);

/** Step 1 asks only for project and name. */
async function fillJob(user: ReturnType<typeof userEvent.setup>) {
  await chooseOption(user, screen.getByRole('combobox', { name: 'Kampagne' }), 'Black Friday');
  fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
    target: { value: 'Kontaktformular-Test' },
  });
}

function fillStartUrl() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Website (Start-URL)' }), {
    target: { value: '127.0.0.1:4100/kontakt.html' },
  });
}

/** Through step 1 into step 2, with the start address entered there. */
async function toFlowStep(user: ReturnType<typeof userEvent.setup>) {
  await fillJob(user);
  await user.click(weiter());
  fillStartUrl();
}

async function confirmApproval(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /Test freigegeben/ }));
}

describe('NewJobWizard', () => {
  it('records steps in the live browser and takes them over', async () => {
    vi.stubGlobal('WebSocket', FakeLiveSocket);
    const user = userEvent.setup();
    const startRecording = vi.fn<StartRecordingAction>(async () => ({
      ok: true,
      url: 'ws://localhost:4200/live?token=t',
    }));
    renderWizard(undefined, undefined, startRecording);
    await toFlowStep(user);

    await user.click(screen.getByRole('button', { name: /Im Browser aufnehmen/ }));
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
    vi.unstubAllGlobals();
  });

  it('says why the live browser does not start', async () => {
    const user = userEvent.setup();
    renderWizard(undefined, undefined, async () => ({
      ok: false,
      message: 'Der Worker ist offline. Ohne ihn gibt es keinen Live-Browser.',
    }));
    await toFlowStep(user);
    await user.click(screen.getByRole('button', { name: /Im Browser aufnehmen/ }));
    await user.click(screen.getByRole('button', { name: 'Aufnahme starten' }));
    expect(await screen.findByText(/Der Worker ist offline/)).toBeVisible();
  });

  it('takes over the steps the AI suggests for a description, with the answers asked for', async () => {
    const user = userEvent.setup();
    const suggestAction = vi.fn<SuggestFlowAction>(async () => ({
      ok: true,
      steps: [
        { ...newStep('open', [], 'https://127.0.0.1:4100/kontakt.html'), id: 'ki-1' },
        { ...newStep('click', [], ''), id: 'ki-2', targetRole: 'button', targetValue: 'Absenden' },
      ],
      questions: [{ question: 'Welches Event?', options: ['generate_lead', 'form_submit'] }],
      facts: [],
      notice: null,
    }));
    renderWizard(undefined, suggestAction);
    await toFlowStep(user);

    await user.click(screen.getByRole('button', { name: /Mit KI beschreiben/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Was soll der Bot tun?' }),
      'Sende das Formular ab.',
    );
    await user.click(screen.getByRole('button', { name: 'Vorschlag erzeugen' }));
    expect(suggestAction).toHaveBeenLastCalledWith({
      startUrl: '127.0.0.1:4100/kontakt.html',
      description: 'Sende das Formular ab.',
      answers: [],
    });

    await user.click(await screen.findByRole('button', { name: 'form_submit' }));
    await user.click(screen.getByRole('button', { name: 'Neu erzeugen' }));
    expect(suggestAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ answers: [{ question: 'Welches Event?', answer: 'form_submit' }] }),
    );

    await user.click(await screen.findByRole('button', { name: '2 Schritte übernehmen' }));
    expect(screen.getByRole('button', { name: /Schritte zusammenklicken/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Schritt 2: Klicke auf „Absenden“' })).toBeVisible();
  });

  it('shows why the AI made no suggestion', async () => {
    const user = userEvent.setup();
    renderWizard(undefined, async () => ({ ok: false, message: 'Custom ist nicht erreichbar.' }));
    await toFlowStep(user);
    await user.click(screen.getByRole('button', { name: /Mit KI beschreiben/ }));
    await user.click(screen.getByRole('button', { name: 'Vorschlag erzeugen' }));
    expect(await screen.findByText('Custom ist nicht erreichbar.')).toBeVisible();
  });

  it('chooses the only campaign of the project right away', async () => {
    const user = userEvent.setup();
    render(
      <NewJobWizard
        campaigns={[{ id: 'k1', name: 'Allgemein' }]}
        now={NOW}
        createAction={vi.fn()}
        suggestAction={noSuggestion}
        startRecording={noRecording}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Kampagne' })).toHaveTextContent('Allgemein');
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt' },
    });
    await user.click(weiter());
    expect(subtitle()).toHaveTextContent('Schritt 2 von 4');
  });

  it('stays on the first step and names every missing field', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(weiter());

    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die markierten Angaben prüfen.');
    expect(subtitle()).toHaveTextContent('Schritt 1 von 4 · Zu welcher Kampagne gehört der Job?');
    expect(screen.getByRole('combobox', { name: 'Kampagne' })).toBeInvalid();
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toBeInvalid();
    expect(screen.queryByRole('textbox', { name: 'Website (Start-URL)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // Clicks through all four steps; with coverage instrumentation that takes longer than 5 s.
  it('walks through all four steps and saves the job', { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    const createAction = renderWizard();

    await fillJob(user);
    await user.click(weiter());

    // Step 2 asks for the start address; the flow starts with opening it.
    expect(subtitle()).toHaveTextContent(
      'Schritt 2 von 4 · Wo beginnt der Test, und was soll passieren?',
    );
    fillStartUrl();
    expect(summary().getByText('127.0.0.1:4100/kontakt.html')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Schritt 1: Öffne 127\.0\.0\.1:4100/ }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));
    await chooseOption(user, screen.getByRole('combobox', { name: 'Aktion' }), 'Prüfen');
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
      target: { value: 'Kontakt' },
    });
    expect(summary().getByText('2 Schritte')).toBeInTheDocument();
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 3 von 4');
    fireEvent.change(screen.getByRole('textbox', { name: 'Alle (Minuten)' }), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Max. Läufe' }), {
      target: { value: '4' },
    });
    expect(summary().getByText('alle 15 Min. · max. 4 Läufe')).toBeInTheDocument();
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 4 von 4');
    await user.click(screen.getByRole('button', { name: /iPhone 15/ }));
    expect(summary().getByText('Desktop (Chrome), iPhone 15 (Safari)')).toBeInTheDocument();
    expect(screen.getByText(/4 Starts × 2 Geräte = 8 Läufe/)).toBeInTheDocument();

    // The confirmation that the website may be tested comes right before creating the job.
    await user.click(screen.getByRole('button', { name: 'Job anlegen' }));
    expect(createAction).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Bitte bestätigen, dass ihr diese Website testen dürft.',
    );
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Job anlegen' }));

    expect(createAction).toHaveBeenCalledOnce();
    expect(createAction.mock.calls[0]?.[0]).toMatchObject({
      campaignId: 'k2',
      name: 'Kontaktformular-Test',
      devices: ['desktop', 'iphone'],
      schedule: { type: 'interval', everyMinutes: '15', maxRuns: '4' },
      steps: [
        { type: 'open', url: 'https://127.0.0.1:4100/kontakt.html' },
        { type: 'assert', value: 'Kontakt' },
      ],
    });
  });

  it('goes back with "Zurück" and through the finished steps above', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toFlowStep(user);
    await user.click(weiter());
    expect(subtitle()).toHaveTextContent('Schritt 3 von 4');

    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(subtitle()).toHaveTextContent('Schritt 2 von 4');

    await user.click(screen.getByRole('button', { name: '1 · Job (erledigt)' }));
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveValue('Kontaktformular-Test');
    expect(screen.getByRole('link', { name: 'Abbrechen' })).toHaveAttribute('href', '/');
  });

  it('marks an invalid flow step and opens it for editing', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toFlowStep(user);

    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));
    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Element finden über' }),
      'Label',
    );
    await user.click(screen.getByRole('button', { name: /^Schritt 1:/ }));
    await user.click(weiter());

    expect(subtitle()).toHaveTextContent('Schritt 2 von 4');
    expect(screen.getByRole('region', { name: 'Schritt 2 bearbeiten' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveAccessibleDescription(
      'Bitte ausfüllen.',
    );
  });

  it('reorders and removes steps, keeping the selection on the moved step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toFlowStep(user);
    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));

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
    await toFlowStep(user);
    await user.click(weiter());
    await user.click(weiter());

    await user.click(screen.getByRole('button', { name: /Desktop/ }));
    await user.click(screen.getByRole('button', { name: 'Job anlegen' }));

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
    await toFlowStep(user);
    await user.click(weiter());
    await user.click(screen.getByRole('radio', { name: 'Termine' }));
    await user.click(weiter());
    await confirmApproval(user);
    await user.click(screen.getByRole('button', { name: 'Job anlegen' }));

    expect(subtitle()).toHaveTextContent('Schritt 3 von 4');
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveAccessibleDescription(
      'Der Termin liegt in der Vergangenheit.',
    );
  });
});
