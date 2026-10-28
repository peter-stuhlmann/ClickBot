import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'click', label: 'Klicken' },
  { value: 'fill', label: 'Ausfüllen' },
];

describe('Select', () => {
  it('offers its options and reports the chosen value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Aktion"
        options={options}
        value="click"
        onChange={(event) => onChange(event.target.value)}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Aktion' }), 'Ausfüllen');

    expect(onChange).toHaveBeenCalledWith('fill');
  });

  it('starts with an empty placeholder entry when given one', () => {
    render(<Select aria-label="Kunde" options={options} placeholder="Kunde wählen" />);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Kunde wählen',
      'Klicken',
      'Ausfüllen',
    ]);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});
