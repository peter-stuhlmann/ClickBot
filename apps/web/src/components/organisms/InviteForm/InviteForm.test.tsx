import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/lib/views';
import { InviteForm } from './InviteForm';
import { chooseOption } from '../../../../test/select';

describe('InviteForm', () => {
  it('creates a link for an address and role and shows it once', async () => {
    const user = userEvent.setup();
    const action = vi.fn<FormAction>(async () => ({
      link: 'http://localhost:3000/einladung/abc',
    }));
    render(<InviteForm action={action} />);

    await user.type(screen.getByLabelText('E-Mail'), 'anna@agentur.de');
    await chooseOption(
      user,
      screen.getByRole('combobox', { name: 'Rolle' }),
      'Admin (verwaltet das Team)',
    );
    await user.click(screen.getByRole('button', { name: 'Einladungslink erstellen' }));

    const data = action.mock.calls[0]?.[1];
    expect(data?.get('email')).toBe('anna@agentur.de');
    expect(data?.get('role')).toBe('admin');
    expect(await screen.findByRole('textbox', { name: 'Einladungslink' })).toHaveValue(
      'http://localhost:3000/einladung/abc',
    );
    expect(screen.getByRole('status')).toHaveTextContent('nur jetzt sichtbar');
  });

  it('shows a wrong address at its field', async () => {
    const user = userEvent.setup();
    render(
      <InviteForm
        action={async () => ({
          fieldErrors: { email: 'Bitte eine gültige E-Mail-Adresse eingeben.' },
          values: { email: 'anna@x' },
        })}
      />,
    );
    await user.type(screen.getByLabelText('E-Mail'), 'anna@x');
    await user.click(screen.getByRole('button', { name: 'Einladungslink erstellen' }));
    expect(await screen.findByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
