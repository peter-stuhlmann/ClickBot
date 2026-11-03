import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StepItemView } from '@/lib/views';
import { StepList } from './StepList';

const view = (title: string): StepItemView => ({
  typeLabel: 'Klicken',
  tone: 'primary',
  title,
  detail: '',
});

const steps = [
  { key: 'a', view: view('Öffne beispiel.de'), invalid: false },
  { key: 'b', view: view('Klicke auf „Kontakt“'), invalid: true },
  { key: 'c', view: view('Prüfe: „Danke“ ist sichtbar'), invalid: false },
];

const handlers = () => ({
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onMove: vi.fn(),
  onRemove: vi.fn(),
});

describe('StepList', () => {
  it('inserts a wait or a screenshot after a step, with buttons between the steps', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<StepList steps={steps} selectedIndex={null} {...handlers()} onInsert={onInsert} />);

    await user.click(screen.getByRole('button', { name: 'Warten nach Schritt 1 einfügen' }));
    await user.click(
      screen.getByRole('button', { name: 'Bildschirmfoto nach Schritt 3 einfügen' }),
    );
    expect(onInsert.mock.calls).toEqual([
      [0, 'wait'],
      [2, 'screenshot'],
    ]);
    // One place after every step, also after the last one.
    expect(screen.getAllByRole('button', { name: /^Warten nach Schritt/ })).toHaveLength(3);
  });

  it('has no insert buttons without onInsert', () => {
    render(<StepList steps={steps} selectedIndex={null} {...handlers()} />);
    expect(screen.queryByRole('button', { name: /einfügen$/ })).not.toBeInTheDocument();
  });

  it('lists the steps in order with their count', () => {
    render(<StepList steps={steps} selectedIndex={1} {...handlers()} />);
    const list = screen.getByRole('region', { name: 'Ablauf' });
    expect(list).toHaveTextContent('3 Schritte');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Schritt 2:/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('selects, moves and removes steps by position', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<StepList steps={steps} selectedIndex={null} {...props} />);

    await user.click(screen.getByRole('button', { name: /^Schritt 3:/ }));
    await user.click(screen.getByRole('button', { name: 'Schritt 2 nach oben' }));
    await user.click(screen.getByRole('button', { name: 'Schritt 2 nach unten' }));
    await user.click(screen.getByRole('button', { name: 'Schritt 1 löschen' }));

    expect(props.onSelect).toHaveBeenCalledWith(2);
    expect(props.onMove.mock.calls).toEqual([
      [1, -1],
      [1, 1],
    ]);
    expect(props.onRemove).toHaveBeenCalledWith(0);
  });

  it('does not offer to move the first step up or the last one down', () => {
    render(<StepList steps={steps} selectedIndex={null} {...handlers()} />);
    expect(screen.getByRole('button', { name: 'Schritt 1 nach oben' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Schritt 3 nach unten' })).toBeDisabled();
  });

  it('adds a step and shows an error for the whole list', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <StepList
        steps={[]}
        selectedIndex={null}
        error="Der Ablauf braucht mindestens einen Schritt."
        {...props}
      />,
    );
    expect(screen.getByRole('region', { name: 'Ablauf' })).toHaveTextContent('Noch leer');
    expect(screen.getByText('Der Ablauf braucht mindestens einen Schritt.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Schritt hinzufügen' }));
    expect(props.onAdd).toHaveBeenCalledOnce();
  });

  it('offers own buttons instead of adding steps, e.g. for a recorded flow', () => {
    const { onAdd: _onAdd, ...props } = handlers();
    render(
      <StepList
        steps={steps}
        selectedIndex={null}
        {...props}
        actions={<button type="button">Neu aufnehmen</button>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Schritt hinzufügen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu aufnehmen' })).toBeVisible();
  });
});
