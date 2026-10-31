import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalCard } from './GoalCard';

describe('GoalCard', () => {
  it('asks for the goal in plain words and shows a problem at it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalCard goal="" error="Bitte ausfüllen." aiReady onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Was soll auf der Website gelten?' });
    expect(field).toHaveAccessibleDescription(/Bitte ausfüllen/);
    await user.type(field, 'B');
    expect(onChange).toHaveBeenLastCalledWith('B');
    expect(screen.queryByText(/kein KI-Anbieter/)).not.toBeInTheDocument();
  });

  it('warns before the first run when no AI provider is set up, with the way there', () => {
    render(<GoalCard goal="" aiReady={false} onChange={vi.fn()} />);
    expect(screen.getByText('Noch kein KI-Anbieter eingerichtet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Zu den KI-Einstellungen' })).toHaveAttribute(
      'href',
      '/einstellungen/ki',
    );
  });
});
