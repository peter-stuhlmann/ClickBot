import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MethodPicker } from './MethodPicker';

const pressed = (name: string) =>
  screen.getByRole('button', { name: new RegExp(name) }).getAttribute('aria-pressed');

describe('MethodPicker', () => {
  it('shows which way is chosen', () => {
    render(<MethodPicker method="ai" onChoose={vi.fn()} />);
    expect(pressed('Mit KI beschreiben')).toBe('true');
    expect(pressed('Schritte zusammenklicken')).toBe('false');
  });

  it('switches between describing with AI and the step builder', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<MethodPicker method="editor" onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /Mit KI beschreiben/ }));
    expect(onChoose).toHaveBeenCalledWith('ai');
  });

  it('offers three ways, all available, and no code', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<MethodPicker method="editor" onChoose={onChoose} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('geplant')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Code schreiben/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Im Browser aufnehmen/ }));
    expect(onChoose).toHaveBeenCalledWith('record');
  });
});
