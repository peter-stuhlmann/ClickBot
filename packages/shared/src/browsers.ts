import { z } from 'zod';

/** The devices a job can run on; the database enum `device` has the same values. */
export const DEVICE_KINDS = ['desktop', 'iphone', 'android', 'ipad'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** Playwright's browser engines; the database enum `browser` has the same values. */
export const BROWSER_KINDS = ['chromium', 'firefox', 'webkit'] as const;
export type BrowserKind = (typeof BROWSER_KINDS)[number];

export const BROWSERS: Record<BrowserKind, { label: string }> = {
  chromium: { label: 'Chrome' },
  firefox: { label: 'Firefox' },
  webkit: { label: 'Safari' },
};

// On iOS every browser is WebKit, and there is no Safari on Android.
const DEVICE_BROWSERS: Record<DeviceKind, readonly BrowserKind[]> = {
  desktop: BROWSER_KINDS,
  iphone: ['webkit'],
  android: ['chromium', 'firefox'],
  ipad: ['webkit'],
};

/** The browsers each device of a job runs in, e.g. { desktop: ['chromium', 'firefox'] }. */
export type DeviceBrowsers = Partial<Record<DeviceKind, BrowserKind[]>>;

export const deviceBrowsersSchema = z.partialRecord(
  z.enum(DEVICE_KINDS),
  z.array(z.enum(BROWSER_KINDS)),
);

/** The browsers a device can run in. */
export function browsersFor(device: DeviceKind): readonly BrowserKind[] {
  return DEVICE_BROWSERS[device];
}

/** The browser a newly chosen device starts with: Chrome, on iOS Safari. */
export function defaultBrowsers(device: DeviceKind): BrowserKind[] {
  return [DEVICE_BROWSERS[device][0] as BrowserKind];
}

/** The chosen browsers of a device that it can run in, in the order of BROWSER_KINDS. */
function chosenFor(device: DeviceKind, deviceBrowsers: DeviceBrowsers): BrowserKind[] {
  const possible = DEVICE_BROWSERS[device];
  if (possible.length === 1) return [...possible];
  const chosen = deviceBrowsers[device] ?? [];
  return possible.filter((browser) => chosen.includes(browser));
}

export type RunTarget = { device: DeviceKind; browser: BrowserKind };

/**
 * The device × browser combinations a job runs as, each one a run per start: by device, then by
 * browser. iPhone and iPad always run once in Safari (WebKit), whatever is stored for them.
 */
export function runTargets(
  devices: readonly DeviceKind[],
  deviceBrowsers: DeviceBrowsers,
): RunTarget[] {
  return [...new Set(devices)].flatMap((device) =>
    chosenFor(device, deviceBrowsers).map((browser) => ({ device, browser })),
  );
}

/** What gets stored: the chosen devices only, each with browsers it can run in. */
export function normalizeDeviceBrowsers(
  devices: readonly DeviceKind[],
  deviceBrowsers: DeviceBrowsers,
): DeviceBrowsers {
  return Object.fromEntries(
    [...new Set(devices)].map((device) => [device, chosenFor(device, deviceBrowsers)]),
  );
}

/** Why a chosen device would not run, by device; empty when every device runs. */
export function deviceBrowserProblems(
  devices: readonly DeviceKind[],
  deviceBrowsers: DeviceBrowsers,
): Partial<Record<DeviceKind, string>> {
  const problems: Partial<Record<DeviceKind, string>> = {};
  for (const device of new Set(devices)) {
    if (chosenFor(device, deviceBrowsers).length > 0) continue;
    const asked = deviceBrowsers[device] ?? [];
    problems[device] =
      device === 'android' && asked.length > 0
        ? 'Android gibt es nur mit Chrome oder Firefox.'
        : 'Mindestens einen Browser wählen.';
  }
  return problems;
}
