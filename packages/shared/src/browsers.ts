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

export type RunTarget = { device: DeviceKind; browser: BrowserKind };

/**
 * The device × browser combinations a job runs as, each one a run per start: by device, then by
 * browser. iPhone and iPad always run once in Safari (WebKit), whatever browsers are chosen.
 */
export function runTargets(
  devices: readonly DeviceKind[],
  browsers: readonly BrowserKind[],
): RunTarget[] {
  return [...new Set(devices)].flatMap((device) => {
    const possible = DEVICE_BROWSERS[device];
    const chosen = possible.length === 1 ? possible : possible.filter((b) => browsers.includes(b));
    return chosen.map((browser) => ({ device, browser }));
  });
}

/** Why the chosen browsers do not work for the chosen devices, or null. */
export function browserProblem(
  devices: readonly DeviceKind[],
  browsers: readonly BrowserKind[],
): string | null {
  if (browsers.length === 0) return 'Mindestens einen Browser wählen.';
  const missing = devices.find((device) => !runTargets([device], browsers).length);
  return missing ? 'Android gibt es nur mit Chrome oder Firefox.' : null;
}
