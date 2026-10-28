import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the page title as the only level-1 heading', () => {
    render(<PageHeader title="Jobs" description="Automatisierte Browser-Abläufe." />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jobs');
    expect(screen.getByText('Automatisierte Browser-Abläufe.')).toBeInTheDocument();
  });

  it('shows actions next to the title', () => {
    render(<PageHeader title="Jobs" actions={<button type="button">Neuer Job</button>} />);
    expect(screen.getByRole('button', { name: 'Neuer Job' })).toBeInTheDocument();
  });

  it('works without description and actions', () => {
    const { container } = render(<PageHeader title="Kalender" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
