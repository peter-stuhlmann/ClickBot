import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevicePicker, type DevicePickerProps } from './DevicePicker';

const props: DevicePickerProps = {
  selected: ['desktop'],
  onToggle: vi.fn(),
  browsers: ['chromium'],
  onToggleBrowser: vi.fn(),
};

describe('DevicePicker', () => {
  it('offers four devices and shows which are chosen', () => {
    render(<DevicePicker {...props} selected={['desktop', 'iphone']} />);
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
    render(<DevicePicker {...props} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: /Android/ }));
    expect(onToggle).toHaveBeenCalledWith('android');
  });

  it('says honestly that location profiles do not exist yet', () => {
    render(<DevicePicker {...props} selected={[]} error="Mindestens ein Gerät wählen." />);
    expect(screen.getByText('Mindestens ein Gerät wählen.')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Von wo aus testen?' })).toHaveTextContent('geplant');
  });

  it('fits a narrow column without the location card', () => {
    render(<DevicePicker {...props} compact />);
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.queryByRole('region', { name: 'Von wo aus testen?' })).not.toBeInTheDocument();
  });

  it('offers Chrome, Firefox and Safari and shows which are chosen', () => {
    render(<DevicePicker {...props} browsers={['chromium', 'webkit']} />);
    const browsers = screen.getByRole('region', { name: 'In welchen Browsern testen?' });
    const pressed = (name: string) =>
      within(browsers)
        .getByRole('button', { name: new RegExp(`^${name}`) })
        .getAttribute('aria-pressed');
    expect(pressed('Chrome')).toBe('true');
    expect(pressed('Firefox')).toBe('false');
    expect(pressed('Safari')).toBe('true');
  });

  it('toggles a browser on click and shows why a choice does not work', async () => {
    const user = userEvent.setup();
    const onToggleBrowser = vi.fn();
    render(
      <DevicePicker
        {...props}
        onToggleBrowser={onToggleBrowser}
        browserError="Android gibt es nur mit Chrome oder Firefox."
      />,
    );
    await user.click(screen.getByRole('button', { name: /^Firefox/ }));
    expect(onToggleBrowser).toHaveBeenCalledWith('firefox');
    expect(screen.getByText('Android gibt es nur mit Chrome oder Firefox.')).toBeVisible();
  });

  it('explains that iPhone and iPad always run in Safari', () => {
    render(<DevicePicker {...props} />);
    expect(screen.getByRole('region', { name: 'In welchen Browsern testen?' })).toHaveTextContent(
      'iPhone und iPad laufen immer in Safari',
    );
  });
});
