import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('shows its text', () => {
    render(<Badge tone="success">Erfolgreich</Badge>);
    expect(screen.getByText('Erfolgreich')).toBeInTheDocument();
  });

  it.each([
    ['success', 'bg-success-soft', 'bg-success-dot'],
    ['warning', 'bg-warning-soft', 'bg-warning-dot'],
    ['danger', 'bg-danger-soft', 'bg-danger-dot'],
    ['neutral', 'bg-neutral-soft', 'bg-text-subtle'],
  ] as const)('colours the %s tone with tokens', (tone, background, dotColour) => {
    render(<Badge tone={tone}>Status</Badge>);
    expect(screen.getByText('Status')).toHaveClass(background);
    expect(screen.getByTestId('badge-dot')).toHaveClass(dotColour);
  });

  it('hides the decorative dot from screen readers', () => {
    render(<Badge tone="danger">Fehlgeschlagen</Badge>);
    expect(screen.getByTestId('badge-dot')).toHaveAttribute('aria-hidden', 'true');
  });
});
