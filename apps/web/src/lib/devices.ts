import {
  BROWSER_KINDS,
  BROWSERS,
  runTargets,
  type BrowserKind,
  type DeviceKind,
} from '@click-bot/shared';

/** The devices a job can run on. Mirrors the `device` enum of the database. */
export type DeviceKey = DeviceKind;
/** The browsers a job can run in. Mirrors the `browser` enum of the database. */
export type BrowserKey = BrowserKind;

export type DeviceOption = { key: DeviceKey; label: string; spec: string };
export type BrowserOption = { key: BrowserKey; label: string; spec: string };

// Viewports as the worker emulates them (Playwright device descriptors); which browser runs which
// device decides runTargets in @click-bot/shared.
export const DEVICE_OPTIONS: readonly DeviceOption[] = [
  { key: 'desktop', label: 'Desktop', spec: '1440 × 900 · Maus · in jedem Browser' },
  { key: 'iphone', label: 'iPhone 15', spec: '393 × 659 · Touch · immer Safari (WebKit)' },
  { key: 'android', label: 'Android (Pixel 8)', spec: '412 × 839 · Touch · Chrome oder Firefox' },
  { key: 'ipad', label: 'iPad', spec: '656 × 944 · Touch · immer Safari (WebKit)' },
];

const BROWSER_SPECS: Record<BrowserKey, string> = {
  chromium: 'Chromium, die Engine von Chrome und Edge',
  firefox: 'Gecko, die Engine von Firefox',
  webkit: 'WebKit, die Engine von Safari',
};

export const BROWSER_OPTIONS: readonly BrowserOption[] = BROWSER_KINDS.map((key) => ({
  key,
  label: BROWSERS[key].label,
  spec: BROWSER_SPECS[key],
}));

export function deviceLabel(key: DeviceKey): string {
  return DEVICE_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

export function browserLabel(key: BrowserKey): string {
  return BROWSERS[key]?.label ?? key;
}

/** "Desktop (Chrome), iPhone 15 (Safari)": every device in the browsers it runs in. */
export function describeTargets(
  devices: readonly DeviceKey[],
  browsers: readonly BrowserKey[],
): string {
  return runTargets(devices, browsers)
    .map(({ device, browser }) => `${deviceLabel(device)} (${browserLabel(browser)})`)
    .join(', ');
}

/** Adds or removes a device, keeping the order of the device cards. */
export function toggleDevice(devices: readonly DeviceKey[], device: DeviceKey): DeviceKey[] {
  const chosen = new Set(devices);
  if (chosen.has(device)) chosen.delete(device);
  else chosen.add(device);
  return DEVICE_OPTIONS.map((option) => option.key).filter((key) => chosen.has(key));
}

/** Adds or removes a browser, keeping the order of the browser cards. */
export function toggleBrowser(browsers: readonly BrowserKey[], browser: BrowserKey): BrowserKey[] {
  const chosen = new Set(browsers);
  if (chosen.has(browser)) chosen.delete(browser);
  else chosen.add(browser);
  return BROWSER_KINDS.filter((key) => chosen.has(key));
}
