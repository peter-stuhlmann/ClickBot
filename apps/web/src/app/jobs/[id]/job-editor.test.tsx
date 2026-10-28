import type { Flow, Schedule } from '@click-bot/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jobToDraft, type Issue, type WizardDraft } from '@/lib/job-draft';
import { JobEditor } from './job-editor';

// 13:30 in Berlin. Only Date is faked, so user-event's timers keep working.
const NOW = '2026-11-05T12:30:00.000Z';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
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
    },
    new Date(NOW),
  );
  if (!('draft' in loaded)) throw new Error(loaded.notEditable);
  return loaded.draft;
}

type SaveAction = (jobId: string, draft: WizardDraft) => Promise<{ issues: Issue[] }>;

function renderEditor({
  initial = draftOf(),
  startedSlots = [] as number[],
  saveAction = vi.fn<SaveAction>(async () => ({ issues: [] })),
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
    />,
  );
  return saveAction;
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
    const saveAction = renderEditor();

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

  it('keeps a stored start in the past, but checks everything else before saving', async () => {
    const user = userEvent.setup();
    const saveAction = renderEditor();

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
});
