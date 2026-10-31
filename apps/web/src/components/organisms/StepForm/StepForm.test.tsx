import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { newStep, type StepDraft, type StepField } from '@/lib/job-draft';
import { StepForm } from './StepForm';
import { chooseOption } from '../../../../test/select';

function Harness({
  initial,
  errors = {},
  onChange = () => {},
}: {
  initial: StepDraft;
  errors?: Partial<Record<StepField, string>>;
  onChange?: (step: StepDraft) => void;
}) {
  const [step, setStep] = useState(initial);
  return (
    <StepForm
      index={2}
      step={step}
      errors={errors}
      onChange={(next) => {
        setStep(next);
        onChange(next);
      }}
    />
  );
}

const step = (type: StepDraft['type'], overrides: Partial<StepDraft> = {}) => ({
  ...newStep(type, [], ''),
  ...overrides,
});

const labels = () =>
  [...document.querySelectorAll('label')].map((label) => label.textContent?.trim());

describe('StepForm', () => {
  it('warns while a CSS selector names an element that does not exist', async () => {
    const user = userEvent.setup();
    render(<Harness initial={step('click', { targetBy: 'css', targetValue: '' })} />);
    const field = screen.getByRole('textbox', { name: 'CSS-Selektor' });

    await user.type(field, 'decline');
    expect(field).toHaveAccessibleDescription(
      '„decline“ sucht ein Element <decline>, das es in HTML nicht gibt. Gemeint ist wohl .decline (Klasse) oder #decline (ID).',
    );

    await user.clear(field);
    await user.type(field, '.decline');
    expect(field).not.toHaveAccessibleDescription(/sucht ein Element/);
  });

  it('is titled with the position and the action of the step', () => {
    render(<Harness initial={step('click')} />);
    expect(screen.getByRole('region', { name: 'Schritt 3 bearbeiten' })).toHaveTextContent(
      'Klicken',
    );
  });

  it('asks an open step only for the address and the timeout', () => {
    render(<Harness initial={step('open')} />);
    expect(labels()).toEqual(['Aktion', 'Adresse', 'Timeout (Sekunden)']);
  });

  it('finds an element by role and name, or by a single value', async () => {
    const user = userEvent.setup();
    render(<Harness initial={step('click')} />);
    expect(labels()).toEqual([
      'Aktion',
      'Element finden über',
      'Rolle',
      'Name',
      'Timeout (Sekunden)',
    ]);

    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Element finden über' }),
      'CSS-Selektor',
    );
    expect(labels()).toEqual([
      'Aktion',
      'Element finden über',
      'CSS-Selektor',
      'Timeout (Sekunden)',
    ]);
    expect(screen.getByRole('textbox', { name: 'CSS-Selektor' })).toHaveClass('font-mono');
  });

  it('switches the fields when the action changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={step('click')} onChange={onChange} />);

    await chooseOption(user, screen.getByRole('combobox', { name: 'Aktion' }), 'Ausfüllen');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'fill' }));
    expect(screen.getByRole('textbox', { name: 'Wert' })).toHaveAccessibleDescription(
      /\{\{faker\.email\}\}/,
    );
  });

  it('suggests finding a form field by its label while the element is not filled in yet', async () => {
    const user = userEvent.setup();
    render(<Harness initial={step('click')} />);

    await chooseOption(user, screen.getByRole('combobox', { name: 'Aktion' }), 'Ausfüllen');
    expect(screen.getByRole('combobox', { name: 'Element finden über' })).toHaveTextContent(
      'Label',
    );

    await chooseOption(user, screen.getByRole('combobox', { name: 'Aktion' }), 'Klicken');
    expect(screen.getByRole('combobox', { name: 'Element finden über' })).toHaveTextContent(
      'Rolle und Name',
    );
  });

  it('keeps an element that is already filled in when the action changes', async () => {
    const user = userEvent.setup();
    render(<Harness initial={step('click', { targetValue: 'Absenden' })} />);

    await chooseOption(user, screen.getByRole('combobox', { name: 'Aktion' }), 'Ausfüllen');

    expect(screen.getByRole('combobox', { name: 'Element finden über' })).toHaveTextContent(
      'Rolle und Name',
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Absenden');
  });

  it('reports typed values', () => {
    const onChange = vi.fn();
    render(<Harness initial={step('fill')} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), {
      target: { value: 'E-Mail' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Wert' }), {
      target: { value: '{{faker.email}}' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Timeout (Sekunden)' }), {
      target: { value: '5' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetValue: 'E-Mail',
        value: '{{faker.email}}',
        timeoutSeconds: '5',
      }),
    );
  });

  it.each([
    ['Text ist sichtbar', ['Aktion', 'Prüfung', 'Text', 'Timeout (Sekunden)']],
    [
      'Element ist sichtbar',
      ['Aktion', 'Prüfung', 'Element finden über', 'Label', 'Timeout (Sekunden)'],
    ],
    ['Adresse enthält', ['Aktion', 'Prüfung', 'Adresse enthält', 'Timeout (Sekunden)']],
    ['Seitentitel enthält', ['Aktion', 'Prüfung', 'Seitentitel enthält', 'Timeout (Sekunden)']],
  ])('checks "%s" with the matching fields', async (kind, expected) => {
    const user = userEvent.setup();
    render(<Harness initial={step('assert')} />);
    await chooseOption(user, screen.getByRole('combobox', { name: 'Prüfung' }), kind);
    expect(labels()).toEqual(expected);
  });

  it.each([
    ['Feste Zeit', ['Aktion', 'Warten auf', 'Sekunden', 'Timeout (Sekunden)']],
    [
      'Bis ein Element erscheint',
      ['Aktion', 'Warten auf', 'Element finden über', 'Label', 'Timeout (Sekunden)'],
    ],
    ['Bis die Seite nichts mehr lädt', ['Aktion', 'Warten auf', 'Timeout (Sekunden)']],
  ])('waits "%s" with the matching fields', async (kind, expected) => {
    const user = userEvent.setup();
    render(<Harness initial={step('wait')} />);
    await chooseOption(user, screen.getByRole('combobox', { name: 'Warten auf' }), kind);
    expect(labels()).toEqual(expected);
  });

  it('takes a waiting time in seconds', () => {
    const onChange = vi.fn();
    render(<Harness initial={step('wait')} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Sekunden' }), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ waitSeconds: '2' }));
  });

  it('names a screenshot and can capture the whole page', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={step('screenshot')} onChange={onChange} />);
    expect(labels()).toContain('Name (optional)');

    await user.click(screen.getByRole('checkbox', { name: /Ganze Seite aufnehmen/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fullPage: true }));
  });

  it.each([
    ['select', 'Option'],
    ['analytics', 'Event-Name'],
  ] as const)('asks a %s step for its %s', (type, label) => {
    render(<Harness initial={step(type)} />);
    expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument();
  });

  it('changes role and name of the element', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={step('click')} onChange={onChange} />);

    await chooseOption(user, screen.getByRole('combobox', { name: 'Rolle' }), 'Link');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Kontakt' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetRole: 'link', targetValue: 'Kontakt' }),
    );
  });

  it('shows errors at their fields and general errors below', () => {
    render(
      <Harness
        initial={step('open', { url: 'kontakt' })}
        errors={{
          url: 'Adresse muss mit http://, https:// oder / beginnen.',
          timeoutSeconds: 'Timeout muss zwischen 0,1 und 120 Sekunden liegen.',
          general: 'Schritt-ID „open-1“ ist doppelt.',
        }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Adresse' })).toHaveAccessibleDescription(
      /Adresse muss mit http/,
    );
    expect(screen.getByRole('textbox', { name: 'Timeout (Sekunden)' })).toBeInvalid();
    expect(screen.getByText('Schritt-ID „open-1“ ist doppelt.')).toBeVisible();
  });
});

describe('StepForm for .htaccess password protection', () => {
  it('asks for user name and password only', () => {
    render(<Harness initial={step('basicAuth')} />);
    expect(labels()).toEqual(['Aktion', 'Benutzername', 'Passwort']);
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByText(/verschlüsselt als Zugangsdaten/)).toBeInTheDocument();
  });

  it('passes what is typed on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={step('basicAuth')} onChange={onChange} />);
    await user.type(screen.getByRole('textbox', { name: 'Benutzername' }), 'kunde');
    await user.type(screen.getByLabelText('Passwort'), 'geheim');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: 'kunde', password: 'geheim' }),
    );
  });

  it('leaves the field empty for a stored password and says that it is kept', () => {
    render(
      <Harness
        initial={step('basicAuth', { storedPassword: '{{secret.htaccess-beispiel-de}}' })}
      />,
    );
    expect(screen.getByLabelText('Passwort')).toHaveValue('');
    expect(screen.getByLabelText('Passwort')).toHaveAttribute(
      'placeholder',
      'Gespeichert – leer lassen, um es zu behalten',
    );
  });

  it('shows the errors at the fields', () => {
    render(
      <Harness
        initial={step('basicAuth')}
        errors={{ username: 'Bitte ausfüllen.', password: 'Bitte ausfüllen.' }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Benutzername' })).toHaveAccessibleDescription(
      /Bitte ausfüllen/,
    );
    expect(screen.getByLabelText('Passwort')).toHaveAccessibleDescription(/Bitte ausfüllen/);
  });
});

describe('StepForm – keys and scrolling', () => {
  it('asks for a key, and for an element only when the key goes to one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={step('press')} onChange={onChange} />);
    expect(labels()).toEqual([
      'Aktion',
      'Taste',
      'Auf einem Element drücken (bekommt vorher den Fokus)',
      'Timeout (Sekunden)',
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Taste' }), 'Escape');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'Escape' }));

    await user.click(screen.getByRole('checkbox', { name: /Auf einem Element drücken/ }));
    expect(labels()).toEqual([
      'Aktion',
      'Taste',
      'Auf einem Element drücken (bekommt vorher den Fokus)',
      'Element finden über',
      'Label',
      'Timeout (Sekunden)',
    ]);
  });

  it('shows what is wrong with a key at its field', () => {
    render(<Harness initial={step('press')} errors={{ key: 'Eine Taste wie „Escape“.' }} />);
    expect(screen.getByRole('textbox', { name: 'Taste' })).toHaveAccessibleDescription(
      /Eine Taste wie „Escape“/,
    );
  });

  it('scrolls from where the page stands by default, a distance in a direction', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={step('scroll')} onChange={onChange} />);
    expect(labels()).toEqual([
      'Aktion',
      'Scrollen',
      'Richtung',
      'Strecke (Pixel)',
      'Timeout (Sekunden)',
    ]);
    expect(screen.getByRole('combobox', { name: 'Scrollen' })).toHaveTextContent(
      'Von der aktuellen Position aus',
    );
    await chooseOption(user, screen.getByRole('combobox', { name: 'Richtung' }), 'Nach links');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scrollDirection: 'left' }));
    const distance = screen.getByRole('textbox', { name: 'Strecke (Pixel)' });
    await user.clear(distance);
    await user.type(distance, '120');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scrollDistance: '120' }));
  });

  it.each([
    [
      'Zu einer Position',
      ['Aktion', 'Scrollen', 'Pixel von oben', 'Pixel von links (optional)', 'Timeout (Sekunden)'],
    ],
    [
      'Bis ein Element zu sehen ist',
      ['Aktion', 'Scrollen', 'Element finden über', 'Rolle', 'Name', 'Timeout (Sekunden)'],
    ],
    ['Bis zum Rand der Seite', ['Aktion', 'Scrollen', 'Richtung', 'Timeout (Sekunden)']],
  ])('scrolls "%s" with the matching fields', async (kind, expected) => {
    const user = userEvent.setup();
    render(<Harness initial={step('scroll')} />);
    await chooseOption(user, screen.getByRole('combobox', { name: 'Scrollen' }), kind);
    expect(labels()).toEqual(expected);
  });

  it('offers all four directions', async () => {
    const user = userEvent.setup();
    render(<Harness initial={step('scroll')} />);
    await user.click(screen.getByRole('combobox', { name: 'Richtung' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Nach unten',
      'Nach oben',
      'Nach rechts',
      'Nach links',
    ]);
  });

  it('shows what is wrong with the pixels at their fields', () => {
    const errors = {
      scrollY: 'Ganze Pixel ab 0.',
      scrollX: 'Links: ganze Pixel ab 0.',
      scrollDistance: 'Ganze Pixel ab 1.',
    };
    const { unmount } = render(
      <Harness initial={step('scroll', { scrollKind: 'position' })} errors={errors} />,
    );
    expect(screen.getByRole('textbox', { name: 'Pixel von oben' })).toHaveAccessibleDescription(
      /Ganze Pixel ab 0/,
    );
    expect(
      screen.getByRole('textbox', { name: 'Pixel von links (optional)' }),
    ).toHaveAccessibleDescription(/Links: ganze Pixel ab 0/);
    unmount();
    render(<Harness initial={step('scroll')} errors={errors} />);
    expect(screen.getByRole('textbox', { name: 'Strecke (Pixel)' })).toHaveAccessibleDescription(
      /Ganze Pixel ab 1/,
    );
  });

  it('offers only the given actions, e.g. no password protection in templates', async () => {
    const user = userEvent.setup();
    render(
      <StepForm
        index={0}
        step={newStep('click', [], '')}
        errors={{}}
        onChange={() => {}}
        types={['open', 'click']}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Aktion' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Seite öffnen',
      'Klicken',
    ]);
  });
});
