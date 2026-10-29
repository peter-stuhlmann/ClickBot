import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SwitchRow } from './SwitchRow';

describe('SwitchRow', () => {
  it('is a switch named by its label, with its description', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <SwitchRow
        label="Debug-Modus"
        description="Ereignisse nur in der DebugView."
        checked
        onToggle={onToggle}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Debug-Modus' });
    expect(toggle).toBeChecked();
    expect(screen.getByText('Ereignisse nur in der DebugView.')).toBeVisible();

    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('can be switched with the keyboard', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<SwitchRow label="Laufnummer" checked={false} onToggle={onToggle} />);
    screen.getByRole('switch', { name: 'Laufnummer' }).focus();
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
