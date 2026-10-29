import type { Flow, Schedule } from '@click-bot/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jobToDraft, type Issue, type WizardDraft } from '@/lib/job-draft';
import { JobEditor } from './job-editor';

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
      customerId: 'c1',
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de/kontakt',
      flow,
      schedule,
      devices: ['desktop'],
      browsers: ['chromium'],
      analyticsMarking: { debugMode: true, internalTraffic: true, botFlag: true, runNumber: true },
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
) => Promise<{ issues: Issue[]; runId?: string }>;

function renderEditor({
  initial = draftOf(),
  startedSlots = [] as number[],
  saveAction = vi.fn<SaveAction>(async () => ({ issues: [] })),
  testRunAction = vi.fn<TestRunAction>(async () => ({ issues: [], runId: 'run-9' })),
} = {}) {
  render(
    <JobEditor
      jobId="job-1"
      header={{
        title: 'Kontaktformular-Test',
        status: { tone: 'success', label: 'Aktiv' },
        description: 'alle 15 Min. · max. 20 Läufe · Desktop',
      }}
      initial={initial}
      now={NOW}
      startedSlots={startedSlots}
      saveAction={saveAction}
      testRunAction={testRunAction}
    />,
  );
  return { saveAction, testRunAction };
}

const saveButton = () => screen.getByRole('button', { name: 'Speichern' });

describe('JobEditor', () => {
  it('shows the stored job and has nothing to save yet', () => {
    renderEditor();
    expect(screen.getByRole('heading', { level: 1, name: 'Kontaktformular-Test' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveValue('Kontaktformular-Test');
    expect(screen.getByRole('textbox', { name: 'Alle (Minuten)' })).toHaveValue('15');
    expect(screen.getByRole('button', { name: /^Schritt 1: Öffne/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(saveButton()).toBeDisabled();
  });

  it('saves a change and says so', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
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

    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt neuer' },
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('saves a switched-off GA4 marking with the job', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    await user.click(screen.getByRole('switch', { name: 'Debug-Modus' }));
    await user.click(saveButton());

    expect(saveAction.mock.calls[0]?.[1].analyticsMarking).toEqual({
      debugMode: false,
      internalTraffic: true,
      botFlag: true,
      runNumber: true,
    });
  });

  it('keeps a stored start in the past, but checks everything else before saving', async () => {
    const user = userEvent.setup();
    const { saveAction } = renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: ' ' },
    });
    await user.click(saveButton());

    expect(saveAction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nicht gespeichert: Bitte die markierten Angaben prüfen.',
    );
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveAccessibleDescription(
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
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
        issues: [{ path: 'job', message: 'Diesen Job gibt es nicht mehr.' }],
      })),
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt neu' },
    });
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nicht gespeichert: Diesen Job gibt es nicht mehr.',
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
    expect(screen.getByRole('radio', { name: 'Intervall' })).toBeDisabled();

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

  describe('Testlauf starten', () => {
    const testButton = () => screen.getByRole('button', { name: 'Testlauf starten' });

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
      fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
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
      fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
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
          issues: [{ path: 'job', message: 'Diesen Job gibt es nicht mehr.' }],
        })),
      });

      await user.click(testButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('Diesen Job gibt es nicht mehr.');
      expect(push).not.toHaveBeenCalled();
    });

    it('names the device it will use', () => {
      renderEditor();
      expect(testButton()).toHaveAttribute(
        'title',
        expect.stringContaining('Ein Bot auf Desktop in Chrome'),
      );
    });
  });
});
