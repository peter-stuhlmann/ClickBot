import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    // Once in the top bar of small screens, once in the column.
    expect(screen.getAllByText('Click-Bot')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Worker online · 1 Lauf aktiv');
    expect(screen.getByText('Peter Stuhlmann')).toBeInTheDocument();
  });

  it('leaves out the user block while nobody is signed in', () => {
    render(<Sidebar active="jobs" worker={worker} user={null} />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});

describe('Sidebar on small screens', () => {
  const menuButton = () => screen.getByRole('button', { name: 'Menü öffnen' });

  it('opens the menu from the top bar and closes it with its close button', async () => {
    const user = userEvent.setup();
    render(<Sidebar active="jobs" worker={worker} user={null} />);
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Menü schließen' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Menü schließen' }));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveFocus();
  });

  it('closes the menu with Escape and by tapping beside it', async () => {
    const user = userEvent.setup();
    render(<Sidebar active="jobs" worker={worker} user={null} />);

    await user.click(menuButton());
    await user.keyboard('{Escape}');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton());
    await user.click(screen.getByTestId('menu-backdrop'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu when a section is chosen', async () => {
    const user = userEvent.setup();
    render(<Sidebar active="jobs" worker={worker} user={null} />);

    await user.click(menuButton());
    await user.click(screen.getByRole('link', { name: 'Läufe' }));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });
});
