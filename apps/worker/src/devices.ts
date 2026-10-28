import type { Device } from '@click-bot/db';
import { devices, type BrowserContextOptions } from 'playwright';

const COMMON: BrowserContextOptions = { locale: 'de-DE', timezoneId: 'Europe/Berlin' };

// Playwright's descriptors for the devices offered in the job wizard (screen 05b).
const DESCRIPTORS: Record<Exclude<Device, 'desktop'>, string> = {
  iphone: 'iPhone 15',
  android: 'Pixel 8',
  ipad: 'iPad (gen 11)',
};

/**
 * Browser context options for a device. All devices run in the shared Chromium: viewport,
 * user agent and touch are emulated, the Safari engine (WebKit) is not.
 */
export function contextOptionsFor(device: Device): BrowserContextOptions {
  if (device === 'desktop') {
    return { ...COMMON, viewport: { width: 1440, height: 900 }, isMobile: false };
  }
  const { defaultBrowserType, ...descriptor } = devices[
    DESCRIPTORS[device]
  ] as (typeof devices)[string];
  return { ...descriptor, ...COMMON };
}
