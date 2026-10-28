import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue, WizardDraft } from '@/lib/job-draft';
import { NewJobWizard } from './new-job-wizard';

// 13:30 in Berlin. Only Date is faked, so user-event's timers keep working.
const NOW = '2026-11-05T12:30:00.000Z';
const customers = [{ id: 'c1', name: 'Beispiel GmbH' }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
});

afterEach(() => {
  vi.useRealTimers();
});

type CreateAction = (draft: WizardDraft) => Promise<{ issues: Issue[] }>;

function renderWizard(createAction = vi.fn<CreateAction>(async () => ({ issues: [] }))) {
  render(<NewJobWizard customers={customers} now={NOW} createAction={createAction} />);
  return createAction;
}

const weiter = () => screen.getByRole('button', { name: 'Weiter' });
const summary = () => within(screen.getByRole('region', { name: 'Zusammenfassung' }));
const subtitle = () => screen.getByText(/^Schritt \d von 4/);

async function fillWebsite(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Kunde' }), 'Beispiel GmbH');
  fireEvent.change(screen.getByRole('textbox', { name: 'Website (Start-URL)' }), {
    target: { value: '127.0.0.1:4100/kontakt.html' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
    target: { value: 'Kontaktformular-Test' },
  });
  await user.click(screen.getByRole('checkbox', { name: /Test freigegeben/ }));
}

describe('NewJobWizard', () => {
  it('stays on the first step and names every missing field', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(weiter());

    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die markierten Angaben prüfen.');
    expect(subtitle()).toHaveTextContent('Schritt 1 von 4 · Welche Website soll getestet werden?');
    expect(screen.getByRole('combobox', { name: 'Kunde' })).toBeInvalid();
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Bitte bestätigen, dass ihr diese Website testen dürft.',
    );
  });

  it('walks through all four steps and saves the job', async () => {
    const user = userEvent.setup();
    const createAction = renderWizard();

    await fillWebsite(user);
    expect(summary().getByText('127.0.0.1:4100/kontakt.html')).toBeInTheDocument();
    await user.click(weiter());

    // Step 2 starts with a step that opens the start URL.
    expect(subtitle()).toHaveTextContent('Schritt 2 von 4 · Wie soll der Ablauf entstehen?');
    expect(
      screen.getByRole('button', { name: /^Schritt 1: Öffne 127\.0\.0\.1:4100/ }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aktion' }), 'Prüfen');
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
    expect(summary().getByText('Desktop, iPhone 15')).toBeInTheDocument();
    expect(screen.getByText(/4 Starts × 2 Geräte = 8 Läufe/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Job anlegen' }));

    expect(createAction).toHaveBeenCalledOnce();
    expect(createAction.mock.calls[0]?.[0]).toMatchObject({
      customerId: 'c1',
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
    await fillWebsite(user);
    await user.click(weiter());
    await user.click(weiter());
    expect(subtitle()).toHaveTextContent('Schritt 3 von 4');

    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(subtitle()).toHaveTextContent('Schritt 2 von 4');

    await user.click(screen.getByRole('button', { name: '1 · Website (erledigt)' }));
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveValue('Kontaktformular-Test');
    expect(screen.getByRole('link', { name: 'Abbrechen' })).toHaveAttribute('href', '/');
  });

  it('marks an invalid flow step and opens it for editing', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillWebsite(user);
    await user.click(weiter());

    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));
    await user.selectOptions(
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
    await fillWebsite(user);
    await user.click(weiter());
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
    await fillWebsite(user);
    await user.click(weiter());
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
    await fillWebsite(user);
    await user.click(weiter());
    await user.click(weiter());
    await user.click(screen.getByRole('radio', { name: 'Termine' }));
    await user.click(weiter());
    await user.click(screen.getByRole('button', { name: 'Job anlegen' }));

    expect(subtitle()).toHaveTextContent('Schritt 3 von 4');
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveAccessibleDescription(
      'Der Termin liegt in der Vergangenheit.',
    );
  });
});
