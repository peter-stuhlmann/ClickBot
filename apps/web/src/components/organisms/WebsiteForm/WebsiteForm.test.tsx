import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WebsiteForm } from './WebsiteForm';

const empty = { customerId: '', startUrl: '', name: '', confirmed: false };
const customers = [
  { id: 'c1', name: 'Beispiel GmbH' },
  { id: 'c2', name: 'Zahnarzt Müller' },
];

describe('WebsiteForm', () => {
  it('reports each field as it changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WebsiteForm values={empty} customers={customers} errors={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Kunde' }), 'Beispiel GmbH');
    fireEvent.change(screen.getByRole('textbox', { name: 'Website (Start-URL)' }), {
      target: { value: 'beispiel.de' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt' },
    });
    await user.click(screen.getByRole('checkbox', { name: /Kunde hat den Test freigegeben/ }));

    expect(onChange.mock.calls).toEqual([
      [{ customerId: 'c1' }],
      [{ startUrl: 'beispiel.de' }],
      [{ name: 'Kontakt' }],
      [{ confirmed: true }],
    ]);
  });

  it('shows the errors next to their fields', () => {
    render(
      <WebsiteForm
        values={empty}
        customers={customers}
        errors={{
          customerId: 'Bitte einen Kunden wählen.',
          startUrl: 'Start-URL muss mit http:// oder https:// beginnen.',
          name: 'Name fehlt.',
          confirmed: 'Bitte bestätigen, dass ihr diese Website testen dürft.',
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Kunde' })).toHaveAccessibleDescription(
      'Bitte einen Kunden wählen.',
    );
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toBeInvalid();
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Bitte bestätigen, dass ihr diese Website testen dürft.',
    );
  });

  it('says so when there are no customers yet', () => {
    render(<WebsiteForm values={empty} customers={[]} errors={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Kunde' })).toHaveAccessibleDescription(
      'Noch keine Kunden angelegt. Kunde anlegen',
    );
    expect(screen.getByRole('link', { name: 'Kunde anlegen' })).toHaveAttribute(
      'href',
      '/kunden/neu',
    );
  });
});
