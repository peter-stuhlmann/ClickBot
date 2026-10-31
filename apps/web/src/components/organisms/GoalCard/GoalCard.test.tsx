import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalCard } from './GoalCard';

describe('GoalCard', () => {
  it('asks for the goal in plain words and shows a problem at it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalCard goal="" error="Bitte ausfüllen." onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' });
    expect(field).toHaveAccessibleDescription(/Bitte ausfüllen/);
    await user.type(field, 'B');
    expect(onChange).toHaveBeenLastCalledWith('B');
  });
});
