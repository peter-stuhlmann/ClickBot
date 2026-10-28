import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/lib/views';
import { AccountForm } from './AccountForm';

describe('AccountForm', () => {
  it('sends name, e-mail and password for the first registration', async () => {
    const user = userEvent.setup();
    const action = vi.fn<FormAction>(async () => ({}));
    render(<AccountForm action={action} submitLabel="Konto anlegen" />);

    await user.type(screen.getByLabelText('Name'), 'Peter Stuhlmann');
    await user.type(screen.getByLabelText('E-Mail'), 'peter@agentur.de');
    await user.type(screen.getByLabelText('Passwort'), 'sonne-wolke-42');
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }));

    const data = action.mock.calls[0]?.[1];
    expect(Object.fromEntries(data?.entries() ?? [])).toEqual({
      name: 'Peter Stuhlmann',
      email: 'peter@agentur.de',
      password: 'sonne-wolke-42',
    });
  });

  it('shows the address of an invitation and sends its token along', async () => {
    const user = userEvent.setup();
    const action = vi.fn<FormAction>(async () => ({}));
    render(
      <AccountForm
        action={action}
        submitLabel="Einladung annehmen"
        fixedEmail="anna@agentur.de"
        hidden={{ token: 'abc' }}
      />,
    );
    expect(screen.queryByRole('textbox', { name: 'E-Mail' })).not.toBeInTheDocument();
    expect(screen.getByText('anna@agentur.de')).toBeVisible();

    await user.type(screen.getByLabelText('Name'), 'Anna');
    await user.type(screen.getByLabelText('Passwort'), 'regen-bogen-77');
    await user.click(screen.getByRole('button', { name: 'Einladung annehmen' }));
    expect(action.mock.calls[0]?.[1].get('token')).toBe('abc');
  });

  it('explains the password rules and shows problems at their fields', async () => {
    const user = userEvent.setup();
    render(
      <AccountForm
        submitLabel="Konto anlegen"
        action={async () => ({
          fieldErrors: { password: 'Dieses Passwort ist aus Datenlecks bekannt (3-mal).' },
          values: { name: 'Peter', email: 'peter@agentur.de' },
        })}
      />,
    );
    const password = screen.getByLabelText('Passwort');
    expect(password).toHaveAccessibleDescription(/Mindestens 10 Zeichen/);
    expect(password).toHaveAttribute('autocomplete', 'new-password');

    await user.type(screen.getByLabelText('Name'), 'Peter');
    await user.type(screen.getByLabelText('E-Mail'), 'peter@agentur.de');
    await user.type(password, 'passwort-123');
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }));

    expect(await screen.findByText(/aus Datenlecks bekannt/)).toBeVisible();
    expect(screen.getByLabelText('Passwort')).toBeInvalid();
    expect(screen.getByLabelText('Name')).toHaveValue('Peter');
  });

  it('shows a problem with the whole form', async () => {
    const user = userEvent.setup();
    render(
      <AccountForm
        submitLabel="Konto anlegen"
        action={async () => ({ error: 'Es gibt schon ein Konto.' })}
      />,
    );
    await user.type(screen.getByLabelText('Name'), 'Peter');
    await user.type(screen.getByLabelText('E-Mail'), 'peter@agentur.de');
    await user.type(screen.getByLabelText('Passwort'), 'sonne-wolke-42');
    await user.click(screen.getByRole('button', { name: 'Konto anlegen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Es gibt schon ein Konto.');
  });
});
