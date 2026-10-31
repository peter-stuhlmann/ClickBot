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
  it('asks for the name and, with several campaigns, for the campaign', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JobBasicsForm values={empty} campaigns={campaigns} errors={{}} onChange={onChange} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Name des Tests' }), {
      target: { value: 'Kontakt' },
    });
    await chooseOption(user, screen.getByRole('combobox', { name: 'Kampagne' }), 'Black Friday');
    expect(onChange.mock.calls).toEqual([[{ name: 'Kontakt' }], [{ campaignId: 'k2' }]]);
    expect(screen.getByRole('link', { name: 'Neue Kampagne' })).toHaveAttribute(
      'href',
      '/kampagnen/neu',
    );
  });

  it('hides the campaign while the project has only one', () => {
    render(
      <JobBasicsForm
        values={{ campaignId: 'k1', name: '' }}
        campaigns={[campaigns[0] as { id: string; name: string }]}
        errors={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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
    expect(screen.getByRole('textbox', { name: 'Name des Tests' })).toHaveAccessibleDescription(
      /Name fehlt\./,
    );
  });
});
