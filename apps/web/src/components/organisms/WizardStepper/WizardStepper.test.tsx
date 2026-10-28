import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WizardStepper } from './WizardStepper';

const steps = [
  { label: 'Website' },
  { label: 'Ablauf' },
  { label: 'Zeitplan' },
  { label: 'Standort & Gerät' },
];

describe('WizardStepper', () => {
  it('marks the current step and lists all four', () => {
    render(<WizardStepper steps={steps} current={1} onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Schritte' });
    expect(nav).toHaveTextContent('1 · Website');
    expect(nav).toHaveTextContent('4 · Standort & Gerät');
    expect(screen.getByText('2 · Ablauf')).toHaveAttribute('aria-current', 'step');
  });

  it('lets the user go back to a finished step, but not ahead', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<WizardStepper steps={steps} current={2} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: '1 · Website (erledigt)' }));
    expect(onSelect).toHaveBeenCalledWith(0);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Standort/ })).not.toBeInTheDocument();
  });
});
