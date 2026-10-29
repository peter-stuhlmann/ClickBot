import type { Browser, Device } from '@click-bot/db';
import { devices, type BrowserContextOptions } from 'playwright';

const COMMON: BrowserContextOptions = { locale: 'de-DE', timezoneId: 'Europe/Berlin' };

// Playwright's descriptors for the devices offered in the job wizard (screen 05b).
const DESCRIPTORS: Record<Exclude<Device, 'desktop'>, string> = {
  iphone: 'iPhone 15',
  android: 'Pixel 8',
  ipad: 'iPad (gen 11)',
};

/**
 * Browser context options for a device in a browser: viewport, user agent and touch. Which
 * browser a device runs in decides runTargets (@click-bot/shared); iPhone and iPad always come
 * with WebKit. `version` is the version of the running browser, for Firefox's user agent.
 */
export function contextOptionsFor(
  device: Device,
  browser: Browser,
  version: string,
): BrowserContextOptions {
  if (device === 'desktop') {
    // The browser's own user agent: Chrome, Firefox or Safari as they are.
    return { ...COMMON, viewport: { width: 1440, height: 900 }, isMobile: false };
  }
  const { defaultBrowserType, ...descriptor } = devices[
    DESCRIPTORS[device]
  ] as (typeof devices)[string];
  if (browser === 'firefox') {
    // The Pixel descriptor announces Chrome; Firefox for Android announces itself. Playwright
    // does not support isMobile in Firefox (clicks wait forever), so the page gets the viewport
    // as its layout width instead of reading its meta viewport tag.
    const { isMobile, ...withoutMobile } = descriptor;
    const major = version.split('.')[0] ?? version;
    const rv = `${major}.0`;
    const userAgent = `Mozilla/5.0 (Android 14; Mobile; rv:${rv}) Gecko/${rv} Firefox/${rv}`;
    return { ...withoutMobile, userAgent, ...COMMON };
  }
  return { ...descriptor, ...COMMON };
}
