import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';

const worker = { online: false, activeRuns: 0 };

describe('Sidebar', () => {
  it('shows the six sections of the design in order', () => {
    render(<Sidebar active="jobs" worker={worker} user={null} />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Kunden', 'Jobs', 'Kalender', 'Läufe', 'Vorlagen', 'Einstellungen']);
  });

  it('marks exactly the active section', () => {
    render(<Sidebar active="kalender" worker={worker} user={null} />);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Kalender']);
  });

  it('shows the product name, the worker status and the signed-in user', () => {
    render(
      <Sidebar
        active="jobs"
        worker={{ online: true, activeRuns: 1 }}
        user={{ name: 'Peter Stuhlmann', role: 'Admin' }}
      />,
    );
    expect(screen.getByText('Click-Bot')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Worker online · 1 Lauf aktiv');
    expect(screen.getByText('Peter Stuhlmann')).toBeInTheDocument();
  });

  it('leaves out the user block while nobody is signed in', () => {
    render(<Sidebar active="jobs" worker={worker} user={null} />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});
