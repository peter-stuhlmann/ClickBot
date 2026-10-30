import {
  BROWSER_KINDS,
  BROWSERS,
  browsersFor,
  defaultBrowsers,
  runTargets,
  type BrowserKind,
  type DeviceBrowsers,
  type DeviceKind,
} from '@click-bot/shared';

/** The devices a job can run on. Mirrors the `device` enum of the database. */
export type DeviceKey = DeviceKind;
/** The browsers a job can run in. Mirrors the `browser` enum of the database. */
export type BrowserKey = BrowserKind;

export type DeviceOption = { key: DeviceKey; label: string; spec: string };

// Viewports as the worker emulates them (Playwright device descriptors); which browsers a device
// can run in decides browsersFor in @click-bot/shared.
export const DEVICE_OPTIONS: readonly DeviceOption[] = [
  { key: 'desktop', label: 'Desktop', spec: '1440 × 900 · Maus' },
  { key: 'iphone', label: 'iPhone 15', spec: '393 × 659 · Touch' },
  { key: 'android', label: 'Android (Pixel 8)', spec: '412 × 839 · Touch' },
  { key: 'ipad', label: 'iPad', spec: '656 × 944 · Touch' },
];

export function deviceLabel(key: DeviceKey): string {
  return DEVICE_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

export function browserLabel(key: BrowserKey): string {
  return BROWSERS[key]?.label ?? key;
}

/** "Desktop (Chrome), iPhone 15 (Safari)": every device in the browsers it runs in. */
export function describeTargets(
  devices: readonly DeviceKey[],
  deviceBrowsers: DeviceBrowsers,
): string {
  return runTargets(devices, deviceBrowsers)
    .map(({ device, browser }) => `${deviceLabel(device)} (${browserLabel(browser)})`)
    .join(', ');
}

/**
 * Adds or removes a device, keeping the order of the device cards. A device chosen without
 * browsers starts in its default one; one switched off keeps its browsers for later.
 */
export function toggleDevice(
  devices: readonly DeviceKey[],
  deviceBrowsers: DeviceBrowsers,
  device: DeviceKey,
): { devices: DeviceKey[]; deviceBrowsers: DeviceBrowsers } {
  const chosen = new Set(devices);
  const adding = !chosen.has(device);
  if (adding) chosen.add(device);
  else chosen.delete(device);
  const remembered = deviceBrowsers[device] ?? [];
  return {
    devices: DEVICE_OPTIONS.map((option) => option.key).filter((key) => chosen.has(key)),
    deviceBrowsers:
      adding && remembered.length === 0
        ? { ...deviceBrowsers, [device]: defaultBrowsers(device) }
        : deviceBrowsers,
  };
}

/** Adds or removes one browser of one device, in the order of BROWSER_KINDS. */
export function toggleDeviceBrowser(
  deviceBrowsers: DeviceBrowsers,
  device: DeviceKey,
  browser: BrowserKey,
): DeviceBrowsers {
  const chosen = new Set(deviceBrowsers[device] ?? []);
  if (chosen.has(browser)) chosen.delete(browser);
  else chosen.add(browser);
  return { ...deviceBrowsers, [device]: BROWSER_KINDS.filter((key) => chosen.has(key)) };
}

export type BrowserChoice = { key: BrowserKey; label: string; chosen: boolean };

/** The browsers to offer for a device; `locked` where there is only one (iOS: Safari). */
export function browserChoices(
  device: DeviceKey,
  deviceBrowsers: DeviceBrowsers,
): { locked: boolean; browsers: BrowserChoice[] } {
  const possible = browsersFor(device);
  const locked = possible.length === 1;
  const chosen = deviceBrowsers[device] ?? [];
  return {
    locked,
    browsers: possible.map((key) => ({
      key,
      label: browserLabel(key),
      chosen: locked || chosen.includes(key),
    })),
  };
}
