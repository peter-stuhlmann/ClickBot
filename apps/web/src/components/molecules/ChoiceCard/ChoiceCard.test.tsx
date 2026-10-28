import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceCard } from './ChoiceCard';

describe('ChoiceCard', () => {
  it('is a toggle button that reports whether it is selected', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ChoiceCard
        icon="phone"
        title="iPhone 15"
        description="393 × 659 · Touch"
        selected={false}
        onClick={onClick}
      />,
    );
    const card = screen.getByRole('button', { name: /iPhone 15/ });
    expect(card).toHaveAttribute('aria-pressed', 'false');

    await user.click(card);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows the selection with the primary colour', () => {
    render(<ChoiceCard icon="desktop" title="Desktop" description="" selected />);
    const card = screen.getByRole('button', { name: /Desktop/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(card).toHaveClass('border-primary');
  });

  it('cannot be chosen while unavailable and says why', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ChoiceCard
        icon="sparkles"
        title="Mit KI beschreiben"
        description="Die KI schlägt die Schritte vor."
        selected={false}
        unavailable="geplant"
        onClick={onClick}
      />,
    );
    const card = screen.getByRole('button', { name: /Mit KI beschreiben/ });
    expect(card).toBeDisabled();
    expect(card).toHaveTextContent('geplant');

    await user.click(card);
    expect(onClick).not.toHaveBeenCalled();
  });
});
