import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSwitcher } from './ProjectSwitcher';

const projects = [
  { id: 'p1', name: 'Beispiel GmbH' },
  { id: 'p2', name: 'Müller Shop' },
  { id: 'p3', name: 'Zahnarzt Weber' },
];

function renderSwitcher(onSelect = vi.fn()) {
  render(
    <ProjectSwitcher
      projects={projects}
      current={projects[1] ?? null}
      onSelect={onSelect}
      newProjectHref="/projekte/neu"
    />,
  );
  return onSelect;
}

const trigger = () => screen.getByRole('button', { name: /Projekt: Müller Shop/ });
const options = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('ProjectSwitcher', () => {
  it('shows the current project and opens the list with a search field in focus', async () => {
    const user = userEvent.setup();
    renderSwitcher();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('searchbox', { name: 'Projekt suchen' })).toHaveFocus();
    expect(options()).toEqual(['Beispiel GmbH', 'Müller Shop', 'Zahnarzt Weber']);
    expect(screen.getByRole('option', { name: 'Müller Shop' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('filters the projects live while typing, ignoring case', async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());
    await user.type(screen.getByRole('searchbox'), 'mü');
    expect(options()).toEqual(['Müller Shop']);

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'xyz');
    expect(screen.queryAllByRole('option')).toEqual([]);
    expect(screen.getByText('Kein Projekt gefunden.')).toBeVisible();
  });

  it('switches to a project on click and closes', async () => {
    const user = userEvent.setup();
    const onSelect = renderSwitcher();
    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'Zahnarzt Weber' }));
    expect(onSelect).toHaveBeenCalledWith('p3');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('can be used with the keyboard: arrows, Enter and Escape', async () => {
    const user = userEvent.setup();
    const onSelect = renderSwitcher();
    await user.click(trigger());
    await user.type(screen.getByRole('searchbox'), 'e');
    // Beispiel GmbH, Müller Shop, Zahnarzt Weber all contain an "e"; the first is active.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p2');

    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes when clicking beside it', async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('always offers to create a new project at the bottom, also when nothing matches', async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(trigger());
    await user.type(screen.getByRole('searchbox'), 'xyz');
    const panel = screen.getByRole('dialog', { name: 'Projekt wechseln' });
    expect(within(panel).getByRole('link', { name: 'Neues Projekt' })).toHaveAttribute(
      'href',
      '/projekte/neu',
    );
  });

  it('invites to create the first project when there is none', () => {
    render(<ProjectSwitcher projects={[]} current={null} onSelect={vi.fn()} newProjectHref="/x" />);
    expect(screen.getByRole('button', { name: /Projekt: keins/ })).toBeVisible();
  });
});
