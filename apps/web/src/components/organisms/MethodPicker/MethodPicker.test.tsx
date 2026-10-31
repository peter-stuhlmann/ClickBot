import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MethodPicker } from './MethodPicker';

const pressed = (name: string) =>
  screen.getByRole('button', { name: new RegExp(name) }).getAttribute('aria-pressed');

describe('MethodPicker', () => {
  it('offers two ways to test, a fixed flow and a free test, and no code', () => {
    render(<MethodPicker method="fixed" onChoose={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(pressed('Fester Ablauf')).toBe('true');
    expect(pressed('Frei mit KI')).toBe('false');
    expect(screen.queryByRole('button', { name: /Code schreiben/ })).not.toBeInTheDocument();
  });

  it('switches to the free test', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<MethodPicker method="fixed" onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /Frei mit KI/ }));
    expect(onChoose).toHaveBeenCalledWith('free');
  });
});
