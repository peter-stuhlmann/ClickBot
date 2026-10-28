import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('is a switch with its state and name', () => {
    render(<Toggle checked label="Job pausieren" />);
    expect(screen.getByRole('switch', { name: 'Job pausieren' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('reports the off state', () => {
    render(<Toggle checked={false} label="Job fortsetzen" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('reacts to click and keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Toggle checked label="Job pausieren" onClick={onClick} />);

    await user.click(screen.getByRole('switch'));
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not react when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Toggle checked={false} disabled label="Beendet" onClick={onClick} />);

    await user.click(screen.getByRole('switch'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('submits its form when used as submit button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Toggle checked type="submit" label="Job pausieren" />
      </form>,
    );

    await user.click(screen.getByRole('switch'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('is a plain button by default, so it never submits by accident', () => {
    render(<Toggle checked label="Job pausieren" />);
    expect(screen.getByRole('switch')).toHaveAttribute('type', 'button');
  });
});
