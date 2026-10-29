import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JobBasicsForm } from './JobBasicsForm';

const empty = { customerId: '', name: '' };
const customers = [
  { id: 'c1', name: 'Beispiel GmbH' },
  { id: 'c2', name: 'Zahnarzt Müller' },
];

describe('JobBasicsForm', () => {
  it('asks only for project and name, and reports each as it changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JobBasicsForm values={empty} customers={customers} errors={{}} onChange={onChange} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Projekt' }), 'Beispiel GmbH');
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt' },
    });
    expect(onChange.mock.calls).toEqual([[{ customerId: 'c1' }], [{ name: 'Kontakt' }]]);
  });

  it('shows the errors next to their fields', () => {
    render(
      <JobBasicsForm
        values={empty}
        customers={customers}
        errors={{ customerId: 'Bitte ein Projekt wählen.', name: 'Name fehlt.' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Projekt' })).toHaveAccessibleDescription(
      'Bitte ein Projekt wählen.',
    );
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveAccessibleDescription(
      /Name fehlt\./,
    );
  });

  it('says so when there are no projects yet', () => {
    render(<JobBasicsForm values={empty} customers={[]} errors={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Projekt' })).toHaveAccessibleDescription(
      'Noch keine Projekte angelegt. Projekt anlegen',
    );
    expect(screen.getByRole('link', { name: 'Projekt anlegen' })).toHaveAttribute(
      'href',
      '/projekte/neu',
    );
  });
});
