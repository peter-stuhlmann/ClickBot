import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevicePicker } from './DevicePicker';

describe('DevicePicker', () => {
  it('offers four devices and shows which are chosen', () => {
    render(<DevicePicker selected={['desktop', 'iphone']} onToggle={vi.fn()} />);
    const pressed = (name: RegExp) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed(/Desktop/)).toBe('true');
    expect(pressed(/iPhone 15/)).toBe('true');
    expect(pressed(/Android \(Pixel 8\)/)).toBe('false');
    expect(pressed(/iPad/)).toBe('false');
  });

  it('toggles a device on click', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<DevicePicker selected={['desktop']} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: /Android/ }));
    expect(onToggle).toHaveBeenCalledWith('android');
  });

  it('says honestly that location profiles do not exist yet', () => {
    render(<DevicePicker selected={[]} error="Mindestens ein Gerät wählen." onToggle={vi.fn()} />);
    expect(screen.getByText('Mindestens ein Gerät wählen.')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Von wo aus testen?' })).toHaveTextContent('geplant');
  });
});
