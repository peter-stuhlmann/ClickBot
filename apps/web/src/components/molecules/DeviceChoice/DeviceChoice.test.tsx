import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeviceChoice, type DeviceChoiceProps } from './DeviceChoice';

const android: DeviceChoiceProps = {
  icon: 'phone',
  title: 'Android (Pixel 8)',
  description: '412 × 839 · Touch',
  selected: true,
  onToggle: vi.fn(),
  browsers: [
    { key: 'chromium', label: 'Chrome', chosen: false },
    { key: 'firefox', label: 'Firefox', chosen: true },
  ],
  onToggleBrowser: vi.fn(),
};

const group = (name: string) => within(screen.getByRole('group', { name }));

describe('DeviceChoice', () => {
  it('is chosen with a press of the device, and shows its browsers then', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<DeviceChoice {...android} selected={false} onToggle={onToggle} />);
    const device = screen.getByRole('button', { name: /^Android \(Pixel 8\)/ });
    expect(device).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    await user.click(device);
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<DeviceChoice {...android} onToggle={onToggle} />);
    expect(device).toHaveAttribute('aria-pressed', 'true');
    const browsers = group('Browser für Android (Pixel 8)');
    expect(browsers.getByRole('button', { name: 'Chrome' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(browsers.getByRole('button', { name: 'Firefox' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches one browser of the device', async () => {
    const user = userEvent.setup();
    const onToggleBrowser = vi.fn();
    render(<DeviceChoice {...android} onToggleBrowser={onToggleBrowser} />);
    await user.click(
      group('Browser für Android (Pixel 8)').getByRole('button', { name: 'Chrome' }),
    );
    expect(onToggleBrowser).toHaveBeenCalledWith('chromium');
  });

  it('shows the only browser of iOS as fixed, with the reason', () => {
    render(
      <DeviceChoice
        {...android}
        icon="phone"
        title="iPhone 15"
        browsers={[{ key: 'webkit', label: 'Safari', chosen: true }]}
        locked="Auf iOS ist jeder Browser Safari (WebKit)."
      />,
    );
    const safari = group('Browser für iPhone 15').getByRole('button', { name: 'Safari' });
    expect(safari).toBeDisabled();
    expect(safari).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Auf iOS ist jeder Browser Safari (WebKit).')).toBeVisible();
  });

  it('says what is missing at the device', () => {
    render(
      <DeviceChoice
        {...android}
        browsers={android.browsers.map((browser) => ({ ...browser, chosen: false }))}
        error="Mindestens einen Browser wählen."
      />,
    );
    expect(
      screen.getByRole('group', { name: 'Browser für Android (Pixel 8)' }),
    ).toHaveAccessibleDescription('Mindestens einen Browser wählen.');
  });
});
