/** The devices a job can run on. Mirrors the `device` enum of the database. */
export type DeviceKey = 'desktop' | 'iphone' | 'android' | 'ipad';

export type DeviceOption = { key: DeviceKey; label: string; spec: string };

// Viewports as the worker emulates them (Playwright device descriptors), all in Chromium.
export const DEVICE_OPTIONS: readonly DeviceOption[] = [
  { key: 'desktop', label: 'Desktop', spec: '1440 × 900 · Chromium · Maus' },
  { key: 'iphone', label: 'iPhone 15', spec: '393 × 659 · Chromium · Touch, iPhone-Kennung' },
  { key: 'android', label: 'Android (Pixel 8)', spec: '412 × 839 · Chromium · Touch' },
  { key: 'ipad', label: 'iPad', spec: '656 × 944 · Chromium · Touch, iPad-Kennung' },
];

export function deviceLabel(key: DeviceKey): string {
  return DEVICE_OPTIONS.find((option) => option.key === key)?.label ?? key;
}
