import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the page title as the only level-1 heading', () => {
    render(<PageHeader title="Tests" description="Automatisierte Browser-Abläufe." />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tests');
    expect(screen.getByText('Automatisierte Browser-Abläufe.')).toBeInTheDocument();
  });

  it('shows actions next to the title', () => {
    render(<PageHeader title="Tests" actions={<button type="button">Neuer Test</button>} />);
    expect(screen.getByRole('button', { name: 'Neuer Test' })).toBeInTheDocument();
  });

  it('works without description and actions', () => {
    const { container } = render(<PageHeader title="Kalender" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('shows the way back above the title and a status next to it', () => {
    render(
      <PageHeader
        title="Durchlauf 7 von 20"
        breadcrumb={[{ label: 'Tests', href: '/' }, { label: 'Durchlauf 7' }]}
        status={{ tone: 'danger', label: 'Fehlgeschlagen' }}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Pfad' })).toHaveTextContent('Tests/Durchlauf 7');
    expect(screen.getByText('Fehlgeschlagen')).toHaveClass('text-danger');
  });

  it('puts a button right next to the title, e.g. the settings of a campaign', () => {
    render(
      <PageHeader
        title="Black Friday"
        titleAside={<button type="button">Kampagne bearbeiten</button>}
      />,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Black Friday' });
    expect(heading.nextElementSibling).toBe(
      screen.getByRole('button', { name: 'Kampagne bearbeiten' }),
    );
  });
});
