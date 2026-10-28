import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/lib/views';
import { CodeForm } from './CodeForm';

describe('CodeForm', () => {
  it('sends the code from the app', async () => {
    const user = userEvent.setup();
    const action = vi.fn<FormAction>(async () => ({}));
    render(<CodeForm action={action} submitLabel="Anmelden" />);

    const code = screen.getByLabelText('Code aus der Authenticator-App');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('inputmode', 'numeric');
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(action.mock.calls[0]?.[1].get('code')).toBe('123456');
  });

  it('says when the code is wrong', async () => {
    const user = userEvent.setup();
    render(<CodeForm action={async () => ({ error: 'Der Code stimmt nicht.' })} />);
    await user.type(screen.getByLabelText('Code aus der Authenticator-App'), '000000');
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Code stimmt nicht.');
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeEnabled();
  });

  it('leads back to the login after too many wrong codes', async () => {
    const user = userEvent.setup();
    render(
      <CodeForm
        action={async () => ({
          error: 'Zu viele falsche Codes. Bitte neu anmelden.',
          restart: true,
        })}
      />,
    );
    await user.type(screen.getByLabelText('Code aus der Authenticator-App'), '000000');
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByRole('link', { name: 'Zur Anmeldung' })).toHaveAttribute(
      'href',
      '/anmelden',
    );
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeDisabled();
  });
});
