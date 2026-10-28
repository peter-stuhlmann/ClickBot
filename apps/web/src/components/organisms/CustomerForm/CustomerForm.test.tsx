import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerForm, type CustomerFormState } from './CustomerForm';

type Action = (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;

describe('CustomerForm', () => {
  it('sends the name to the action', async () => {
    const user = userEvent.setup();
    const action = vi.fn<Action>(async () => ({}));
    render(<CustomerForm action={action} />);

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Müller Shop');
    await user.click(screen.getByRole('button', { name: 'Kunde anlegen' }));

    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0]?.[1].get('name')).toBe('Müller Shop');
  });

  it('shows why the customer was not created and keeps the name', async () => {
    const user = userEvent.setup();
    render(
      <CustomerForm
        action={async () => ({ error: 'Diesen Kunden gibt es schon.', name: 'Beispiel GmbH' })}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Beispiel GmbH');
    await user.click(screen.getByRole('button', { name: 'Kunde anlegen' }));

    // Wait for the answer of the action, not just for the field, which is there from the start.
    await screen.findByText('Diesen Kunden gibt es schon.');
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveAccessibleDescription('Diesen Kunden gibt es schon.');
    expect(name).toHaveValue('Beispiel GmbH');
  });

  it('leads back to the customer list', () => {
    render(<CustomerForm action={async () => ({})} />);
    expect(screen.getByRole('link', { name: 'Abbrechen' })).toHaveAttribute('href', '/kunden');
  });
});
