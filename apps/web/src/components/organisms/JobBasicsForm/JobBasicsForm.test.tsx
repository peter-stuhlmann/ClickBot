import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JobBasicsForm } from './JobBasicsForm';
import { chooseOption } from '../../../../test/select';

const empty = { campaignId: '', name: '' };
const campaigns = [
  { id: 'k1', name: 'Allgemein' },
  { id: 'k2', name: 'Black Friday' },
];

describe('JobBasicsForm', () => {
  it('asks only for campaign and name, and reports each as it changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JobBasicsForm values={empty} campaigns={campaigns} errors={{}} onChange={onChange} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    await chooseOption(user, screen.getByRole('combobox', { name: 'Kampagne' }), 'Black Friday');
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt' },
    });
    expect(onChange.mock.calls).toEqual([[{ campaignId: 'k2' }], [{ name: 'Kontakt' }]]);
  });

  it('shows the errors next to their fields', () => {
    render(
      <JobBasicsForm
        values={empty}
        campaigns={campaigns}
        errors={{ campaignId: 'Bitte eine Kampagne wählen.', name: 'Name fehlt.' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Kampagne' })).toHaveAccessibleDescription(
      /Bitte eine Kampagne wählen\./,
    );
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveAccessibleDescription(
      /Name fehlt\./,
    );
  });

  it('offers to create a campaign', () => {
    render(<JobBasicsForm values={empty} campaigns={campaigns} errors={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Neue Kampagne' })).toHaveAttribute(
      'href',
      '/kampagnen/neu',
    );
  });
});
