import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('toggles when its label is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Ganze Seite aufnehmen" onChange={onChange} />);

    await user.click(screen.getByText('Ganze Seite aufnehmen'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { name: 'Ganze Seite aufnehmen' })).toBeChecked();
  });

  it('can be toggled with the space key', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Freigabe liegt vor" />);
    screen.getByRole('checkbox').focus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
