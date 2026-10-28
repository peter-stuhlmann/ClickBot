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

  it('shows the way back above the title and a status next to it', () => {
    render(
      <PageHeader
        title="Lauf #7 von 20"
        breadcrumb={[{ label: 'Jobs', href: '/' }, { label: 'Lauf #7' }]}
        status={{ tone: 'danger', label: 'Fehlgeschlagen' }}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Pfad' })).toHaveTextContent('Jobs/Lauf #7');
    expect(screen.getByText('Fehlgeschlagen')).toHaveClass('text-danger');
  });
});
