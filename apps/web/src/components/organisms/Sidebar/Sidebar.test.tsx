import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const worker = { online: false, activeRuns: 0 };
const projects = [
  { id: 'p1', name: 'Beispiel GmbH' },
  { id: 'p2', name: 'Müller Shop' },
];
const shell = { projects, project: projects[0] ?? null, selectProject: () => {} };

describe('Sidebar', () => {
  it('shows the six sections of the design in order', () => {
    render(<Sidebar active="jobs" worker={worker} user={null} {...shell} />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Tests', 'Durchläufe', 'Kalender', 'Kampagnen', 'Vorlagen', 'Einstellungen']);
  });

  it('marks exactly the active section', () => {
    render(<Sidebar active="kalender" worker={worker} user={null} {...shell} />);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Kalender']);
  });

  it('marks the user card instead of a section on the profile page', () => {
    render(
      <Sidebar
        active="profil"
        worker={worker}
        user={{ name: 'Peter Stuhlmann', role: 'Admin' }}
        {...shell}
      />,
    );
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Profil: Peter Stuhlmann',
    ]);
  });

  it('shows the product name, the worker status and the signed-in user', () => {
    render(
      <Sidebar
        active="jobs"
        worker={{ online: true, activeRuns: 1 }}
        user={{ name: 'Peter Stuhlmann', role: 'Admin' }}
        {...shell}
      />,
    );
    // Once in the top bar of small screens, once in the column.
    expect(screen.getAllByText('Click-Bot')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Testsystem bereit · 1 Durchlauf aktiv');
    expect(screen.getByText('Peter Stuhlmann')).toBeInTheDocument();
  });

  it('shows the current project above the navigation and switches it', async () => {
    const user = userEvent.setup();
    const selectProject = vi.fn();
    render(
      <Sidebar
        active="jobs"
        worker={worker}
        user={null}
        {...shell}
        selectProject={selectProject}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Projekt: Beispiel GmbH' }));
    await user.click(screen.getByRole('option', { name: 'Müller Shop' }));
    expect(selectProject).toHaveBeenCalledWith('p2');
  });

  it('leaves out the user block while nobody is signed in', () => {
    render(<Sidebar active="jobs" worker={worker} user={null} {...shell} />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});

describe('Sidebar on small screens', () => {
  const menuButton = () => screen.getByRole('button', { name: 'Menü öffnen' });

  it('opens the menu from the top bar and closes it with its close button', async () => {
    const user = userEvent.setup();
    render(<Sidebar active="jobs" worker={worker} user={null} {...shell} />);
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
    render(<Sidebar active="jobs" worker={worker} user={null} {...shell} />);

    await user.click(menuButton());
    await user.keyboard('{Escape}');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton());
    await user.click(screen.getByTestId('menu-backdrop'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu when a section is chosen', async () => {
    const user = userEvent.setup();
    render(<Sidebar active="jobs" worker={worker} user={null} {...shell} />);

    await user.click(menuButton());
    await user.click(screen.getByRole('link', { name: 'Durchläufe' }));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });
});

vi.mock('next/navigation', () => ({ usePathname: () => '/kalender?woche=2026-11-02' }));

describe('Sidebar without an active section', () => {
  it('marks the section of the current address, as the layout relies on', () => {
    render(<Sidebar worker={worker} user={null} {...shell} />);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Kalender']);
  });

  it('shows the switcher busy until the chosen project is applied', async () => {
    let finish!: () => void;
    const selectProject = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Sidebar worker={worker} user={null} {...shell} selectProject={selectProject} />);
    const trigger = screen.getByRole('button', { name: /^Projekt: / });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', { name: 'Müller Shop' }));
    expect(selectProject).toHaveBeenCalledWith('p2');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(trigger).toBeDisabled();
    finish();
    await waitFor(() => expect(trigger).not.toHaveAttribute('aria-busy'));
  });
});
