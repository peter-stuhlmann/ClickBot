import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevicePicker, type DevicePickerProps } from './DevicePicker';

const props: DevicePickerProps = {
  selected: ['desktop'],
  deviceBrowsers: { desktop: ['chromium'] },
  onToggle: vi.fn(),
  onToggleBrowser: vi.fn(),
};

const browsersOf = (device: string) =>
  within(screen.getByRole('group', { name: `Browser für ${device}` }));

describe('DevicePicker', () => {
  it('offers four devices and shows which are chosen', () => {
    render(<DevicePicker {...props} selected={['desktop', 'iphone']} />);
    const pressed = (name: RegExp) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed(/^Desktop/)).toBe('true');
    expect(pressed(/^iPhone 15/)).toBe('true');
    expect(pressed(/^Android \(Pixel 8\)/)).toBe('false');
    expect(pressed(/^iPad/)).toBe('false');
  });

  it('toggles a device on click', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<DevicePicker {...props} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: /^Android/ }));
    expect(onToggle).toHaveBeenCalledWith('android');
  });

  it('offers each chosen device its own browsers', () => {
    render(
      <DevicePicker
        {...props}
        selected={['desktop', 'android', 'ipad']}
        deviceBrowsers={{ desktop: ['chromium', 'webkit'], android: ['firefox'] }}
      />,
    );
    const pressed = (device: string) =>
      browsersOf(device)
        .getAllByRole('button')
        .map((chip) => `${chip.textContent}:${chip.getAttribute('aria-pressed')}`);
    expect(pressed('Desktop')).toEqual(['Chrome:true', 'Firefox:false', 'Safari:true']);
    expect(pressed('Android (Pixel 8)')).toEqual(['Chrome:false', 'Firefox:true']);
    expect(pressed('iPad')).toEqual(['Safari:true']);
    expect(browsersOf('iPad').getByRole('button', { name: 'Safari' })).toBeDisabled();
    // Devices that are not chosen show no browsers.
    expect(screen.queryByRole('group', { name: 'Browser für iPhone 15' })).not.toBeInTheDocument();
  });

  it('switches a browser of one device and says what a device is missing', async () => {
    const user = userEvent.setup();
    const onToggleBrowser = vi.fn();
    render(
      <DevicePicker
        {...props}
        selected={['desktop', 'android']}
        deviceBrowsers={{ desktop: ['chromium'], android: [] }}
        browserErrors={{ android: 'Mindestens einen Browser wählen.' }}
        onToggleBrowser={onToggleBrowser}
      />,
    );
    await user.click(browsersOf('Desktop').getByRole('button', { name: 'Firefox' }));
    expect(onToggleBrowser).toHaveBeenCalledWith('desktop', 'firefox');
    expect(
      screen.getByRole('group', { name: 'Browser für Android (Pixel 8)' }),
    ).toHaveAccessibleDescription('Mindestens einen Browser wählen.');
  });

  it('says at once when a chosen device has no browser left', () => {
    render(<DevicePicker {...props} selected={['desktop']} deviceBrowsers={{ desktop: [] }} />);
    expect(screen.getByRole('group', { name: 'Browser für Desktop' })).toHaveAccessibleDescription(
      'Mindestens einen Browser wählen.',
    );
  });

  it('shows a problem with the chosen devices', () => {
    render(<DevicePicker {...props} selected={[]} error="Mindestens ein Gerät wählen." />);
    expect(screen.getByText('Mindestens ein Gerät wählen.')).toBeVisible();
  });
});
