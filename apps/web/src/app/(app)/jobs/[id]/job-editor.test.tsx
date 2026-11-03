import type { Flow, Schedule } from '@click-bot/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jobToDraft, type Issue, type WizardDraft } from '@/lib/job-draft';
import { JobEditor } from './job-editor';
import { chooseOption } from '../../../../../test/select';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// 13:30 in Berlin. Only Date is faked, so user-event's timers keep working.
const NOW = '2026-11-05T12:30:00.000Z';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  push.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const base = { timeoutMs: 10_000, aiFallback: true };
const flow: Flow = {
  version: 1,
  steps: [
    { ...base, id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' },
    {
      ...base,
      id: 'send',
      type: 'click',
      target: { by: 'role', role: 'button', name: 'Absenden' },
    },
  ],
};

const interval: Schedule = {
  type: 'interval',
  everyMinutes: 15,
  maxRuns: 20,
  startAt: '2026-11-05T09:00:00Z',
};

function draftOf(schedule: Schedule = interval): WizardDraft {
  const loaded = jobToDraft(
    {
      campaignId: 'k1',
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de/kontakt',
      flow,
      schedule,
      devices: ['desktop'],
      deviceBrowsers: { desktop: ['chromium'] },
      analyticsMarking: { debugMode: true, internalTraffic: true, botFlag: true, runNumber: true },
      blockAds: true,
      recordVideo: false,
    },
    new Date(NOW),
  );
  if (!('draft' in loaded)) throw new Error(loaded.notEditable);
  return loaded.draft;
}

type SaveAction = (jobId: string, draft: WizardDraft) => Promise<{ issues: Issue[] }>;
type TestRunAction = (
  jobId: string,
  draft: WizardDraft | null,
) => Promise<{ issues: Issue[]; href?: string }>;

function renderEditor({
  initial = draftOf(),
  startedSlots = [] as number[],
  saveAction = vi.fn<SaveAction>(async () => ({ issues: [] })),
  testRunAction = vi.fn<TestRunAction>(async () => ({ issues: [], href: '/laeufe/run-9' })),
} = {}) {
  render(
    <JobEditor
      jobId="job-1"
      header={{
        title: 'Kontaktformular-Test',
        status: { tone: 'success', label: 'Aktiv' },
        description: 'alle 15 Min. · 20-mal · Desktop',
      }}
      initial={initial}
      now={NOW}
      startedSlots={startedSlots}
      saveAction={saveAction}
      testRunAction={testRunAction}
      campaigns={[
        { id: 'k1', name: 'Allgemein' },
        { id: 'k2', name: 'Black Friday' },
      ]}
      deleteAction={async () => ({})}
      saveTemplateAction={async () => ({})}
    />,
  );
  return { saveAction, testRunAction };
}

const saveButton = () => screen.getByRole('button', { name: 'Speichern' });

describe('JobEditor', () => {
  it('moves the job to another campaign of its project', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();
    await chooseOption(user, screen.getByRole('combobox', { name: 'Kampagne' }), 'Black Friday');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(saveAction.mock.calls[0]?.[1]).toMatchObject({ campaignId: 'k2' });
  });

  it('offers to delete the job, after one more question', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Test löschen' }));
    expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();
  });

  it('saves the stored flow as a template, but not while changes are unsaved', async () => {
    const user = userEvent.setup();
    renderEditor();
    const saveTemplate = () => screen.getByRole('button', { name: 'Vorlage erstellen' });
    expect(screen.getByRole('textbox', { name: 'Name der Vorlage' })).toHaveValue(
      'Kontaktformular-Test',
    );
    expect(saveTemplate()).toBeEnabled();

    await user.type(screen.getByRole('textbox', { name: 'Name des Tests' }), '!');
    expect(saveTemplate()).toBeDisabled();
    expect(screen.getByText(/Erst die Änderungen speichern/)).toBeInTheDocument();
  });

  it('shows the stored job and has nothing to save yet', () => {
    renderEditor();
    expect(screen.getByRole('heading', { level: 1, name: 'Kontaktformular-Test' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Name des Tests' })).toHaveValue(
      'Kontaktformular-Test',
    );
    expect(screen.getByRole('textbox', { name: 'Abstand in Minuten' })).toHaveValue('15');
    expect(screen.getByRole('button', { name: /^Schritt 1: Öffne/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(saveButton()).toBeDisabled();
  });

  it('saves a change and says so', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: 'Kontakt neu' },
    });
    await user.click(screen.getByRole('button', { name: /iPhone 15/ }));
    await user.click(saveButton());

    expect(saveAction).toHaveBeenCalledOnce();
    expect(saveAction.mock.calls[0]?.[0]).toBe('job-1');
    expect(saveAction.mock.calls[0]?.[1]).toMatchObject({
      name: 'Kontakt neu',
      devices: ['desktop', 'iphone'],
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.');
    expect(saveButton()).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: 'Kontakt neuer' },
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('saves a switched-off GA4 marking with the job', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    // Technical settings wait behind "Erweiterte Einstellungen".
    await user.click(screen.getByRole('button', { name: 'Erweiterte Einstellungen' }));
    await user.click(screen.getByRole('switch', { name: 'Debug-Modus' }));
    await user.click(saveButton());

    expect(saveAction.mock.calls[0]?.[1].analyticsMarking).toEqual({
      debugMode: false,
      internalTraffic: true,
      botFlag: true,
      runNumber: true,
    });
  });

  it('saves allowed ads with the job, after a clear warning', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Erweiterte Einstellungen' }));
    await user.click(screen.getByRole('switch', { name: /Werbung blockieren/ }));
    expect(screen.getByText('Anzeigen zählen als Impressionen')).toBeVisible();
    await user.click(saveButton());
    expect(saveAction.mock.calls[0]?.[1].blockAds).toBe(false);
  });

  it('opens the technical settings from the start when one of them was changed', () => {
    const changed = { ...draftOf(), blockAds: false };
    renderEditor({ initial: changed });
    expect(screen.getByRole('button', { name: 'Erweiterte Einstellungen' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps a stored start in the past, but checks everything else before saving', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: ' ' },
    });
    await user.click(saveButton());

    expect(saveAction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nicht gespeichert: Bitte die markierten Angaben prüfen.',
    );
    expect(screen.getByRole('textbox', { name: 'Name des Tests' })).toHaveAccessibleDescription(
      'Name fehlt.',
    );
    // The stored start (10:00 today) is in the past and still accepted.
    expect(screen.queryByText('Der Start liegt in der Vergangenheit.')).not.toBeInTheDocument();
  });

  it('opens the step the server complained about', async () => {
    const user = userEvent.setup();
    renderEditor({
      saveAction: vi.fn<SaveAction>(async () => ({
        issues: [{ path: 'flow.steps.1.target.name', message: 'Bitte ausfüllen.' }],
      })),
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: 'Kontakt neu' },
    });
    await user.click(saveButton());

    expect(await screen.findByRole('region', { name: 'Schritt 2 bearbeiten' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      /Bitte ausfüllen\./,
    );
  });

  it('shows a problem with the job as a whole in the message', async () => {
    const user = userEvent.setup();
    renderEditor({
      saveAction: vi.fn<SaveAction>(async () => ({
        issues: [{ path: 'job', message: 'Diesen Test gibt es nicht mehr.' }],
      })),
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: 'Kontakt neu' },
    });
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nicht gespeichert: Diesen Test gibt es nicht mehr.',
    );
  });

  it('locks dates that already have runs, also after other dates moved', async () => {
    const user = userEvent.setup();
    const times: Schedule = {
      type: 'times',
      slots: [
        { date: '2026-11-05', time: '11:00', bots: 2 },
        { date: '2026-11-05', time: '15:00', bots: 1 },
      ],
      staggerSeconds: 10,
      timezone: 'Europe/Berlin',
    };
    renderEditor({ initial: draftOf(times), startedSlots: [0] });

    expect(screen.getByLabelText('Uhrzeit Termin 1')).toBeDisabled();
    expect(screen.getByLabelText('Uhrzeit Termin 2')).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Regelmäßig' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    await user.click(screen.getByRole('button', { name: 'Termin 2 entfernen' }));
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toBeDisabled();
    expect(screen.getByLabelText('Uhrzeit Termin 2')).toHaveValue('16:00');
  });

  it('edits the flow: add, move, remove', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));
    expect(screen.getByRole('region', { name: 'Schritt 3 bearbeiten' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Schritt 3 nach oben' }));
    expect(screen.getByRole('region', { name: 'Schritt 2 bearbeiten' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Schritt 2 löschen' }));
    expect(screen.getAllByRole('button', { name: /^Schritt \d:/ })).toHaveLength(2);

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Senden' },
    });
    expect(screen.getByRole('button', { name: 'Schritt 2: Klicke auf „Senden“' })).toBeVisible();
    expect(saveButton()).toBeEnabled();
  });

  describe('Jetzt ausführen', () => {
    const testButton = () => screen.getByRole('button', { name: 'Jetzt ausführen' });

    it('starts the stored job and opens the report of the run', async () => {
      const user = userEvent.setup();
      const { testRunAction } = renderEditor();

      await user.click(testButton());

      expect(testRunAction).toHaveBeenCalledWith('job-1', null);
      expect(push).toHaveBeenCalledWith('/laeufe/run-9');
    });

    it('saves unsaved changes first, because the worker runs the stored job', async () => {
      const user = userEvent.setup();
      const { testRunAction } = renderEditor();
      fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
        target: { value: 'Kontakt neu' },
      });

      await user.click(testButton());

      expect(testRunAction.mock.calls[0]?.[1]).toMatchObject({ name: 'Kontakt neu' });
      expect(saveButton()).toBeDisabled();
      expect(push).toHaveBeenCalledWith('/laeufe/run-9');
    });

    it('starts nothing while the changes are invalid', async () => {
      const user = userEvent.setup();
      const { testRunAction } = renderEditor();
      fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
        target: { value: '' },
      });

      await user.click(testButton());

      expect(testRunAction).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Nicht gespeichert');
    });

    it('stays in the editor and shows why when the server refuses', async () => {
      const user = userEvent.setup();
      renderEditor({
        testRunAction: vi.fn<TestRunAction>(async () => ({
          issues: [{ path: 'job', message: 'Diesen Test gibt es nicht mehr.' }],
        })),
      });

      await user.click(testButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('Diesen Test gibt es nicht mehr.');
      expect(push).not.toHaveBeenCalled();
    });

    it('names the device it will use, or how many combinations run at once', () => {
      renderEditor();
      expect(testButton()).toHaveAttribute(
        'title',
        expect.stringContaining('Einmal auf Desktop in Chrome'),
      );
      cleanup();
      renderEditor({
        initial: {
          ...draftOf(),
          devices: ['desktop', 'iphone'],
          deviceBrowsers: { desktop: ['chromium', 'firefox'], iphone: ['webkit'] },
        },
      });
      expect(testButton()).toHaveAttribute(
        'title',
        expect.stringContaining('Auf allen gewählten Geräten und Browsern (3 Durchläufe)'),
      );
    });
  });
});
