import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/lib/views';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('sends e-mail and password', async () => {
    const user = userEvent.setup();
    const action = vi.fn<FormAction>(async () => ({}));
    render(<LoginForm action={action} />);

    await user.type(screen.getByLabelText('E-Mail'), 'peter@agentur.de');
    await user.type(screen.getByLabelText('Passwort'), 'sonne-wolke-42');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    const data = action.mock.calls[0]?.[1];
    expect(data?.get('email')).toBe('peter@agentur.de');
    expect(data?.get('password')).toBe('sonne-wolke-42');
  });

  it('shows why the login failed and keeps the address, but never the password', async () => {
    const user = userEvent.setup();
    render(
      <LoginForm
        action={async () => ({
          error: 'E-Mail oder Passwort ist falsch.',
          values: { email: 'peter@agentur.de' },
        })}
      />,
    );
    // Both fields are required; the browser would not send the form otherwise.
    await user.type(screen.getByLabelText('E-Mail'), 'peter@agentur.de');
    await user.type(screen.getByLabelText('Passwort'), 'falsch-falsch-1');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-Mail oder Passwort ist falsch.');
    expect(screen.getByLabelText('E-Mail')).toHaveValue('peter@agentur.de');
    expect(screen.getByLabelText('Passwort')).toHaveValue('');
  });

  it('lets the password manager fill in the fields', () => {
    render(<LoginForm action={async () => ({})} />);
    expect(screen.getByLabelText('E-Mail')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('autocomplete', 'current-password');
  });
});
