import { describe, expect, it } from 'vitest';
import {
  BROWSER_KINDS,
  BROWSERS,
  browsersFor,
  defaultBrowsers,
  deviceBrowserProblems,
  deviceBrowsersSchema,
  normalizeDeviceBrowsers,
  runTargets,
} from './browsers';

describe('BROWSERS', () => {
  it('offers Chrome, Firefox and Safari, by the names users know', () => {
    expect(BROWSER_KINDS.map((kind) => BROWSERS[kind].label)).toEqual([
      'Chrome',
      'Firefox',
      'Safari',
    ]);
  });
});

describe('browsersFor', () => {
  it('lets a desktop run in every browser, Android in Chrome or Firefox, iOS only in Safari', () => {
    expect(browsersFor('desktop')).toEqual(['chromium', 'firefox', 'webkit']);
    expect(browsersFor('android')).toEqual(['chromium', 'firefox']);
    expect(browsersFor('iphone')).toEqual(['webkit']);
    expect(browsersFor('ipad')).toEqual(['webkit']);
  });

  it('starts a newly chosen device in its first browser', () => {
    expect(defaultBrowsers('desktop')).toEqual(['chromium']);
    expect(defaultBrowsers('android')).toEqual(['chromium']);
    expect(defaultBrowsers('iphone')).toEqual(['webkit']);
  });
});

describe('runTargets', () => {
  it('runs every device in its own browsers', () => {
    expect(
      runTargets(['desktop', 'android'], {
        desktop: ['chromium', 'webkit'],
        android: ['firefox'],
      }),
    ).toEqual([
      { device: 'desktop', browser: 'chromium' },
      { device: 'desktop', browser: 'webkit' },
      { device: 'android', browser: 'firefox' },
    ]);
  });

  it('runs iPhone and iPad once in Safari, because every browser on iOS is WebKit', () => {
    expect(runTargets(['iphone', 'ipad'], { iphone: ['chromium'] })).toEqual([
      { device: 'iphone', browser: 'webkit' },
      { device: 'ipad', browser: 'webkit' },
    ]);
  });

  it('never runs Android in Safari, which does not exist there', () => {
    expect(runTargets(['android'], { android: ['webkit', 'firefox'] })).toEqual([
      { device: 'android', browser: 'firefox' },
    ]);
  });

  it('keeps the order of the devices, then of the browsers, and ignores repetitions', () => {
    expect(
      runTargets(['iphone', 'desktop', 'desktop'], { desktop: ['firefox', 'chromium', 'firefox'] }),
    ).toEqual([
      { device: 'iphone', browser: 'webkit' },
      { device: 'desktop', browser: 'chromium' },
      { device: 'desktop', browser: 'firefox' },
    ]);
  });

  it('runs only the chosen devices, also when browsers are remembered for others', () => {
    expect(runTargets(['desktop'], { desktop: ['chromium'], android: ['firefox'] })).toEqual([
      { device: 'desktop', browser: 'chromium' },
    ]);
  });

  it('has nothing to run without devices, or for a device without browsers', () => {
    expect(runTargets([], { desktop: ['chromium'] })).toEqual([]);
    expect(runTargets(['desktop'], {})).toEqual([]);
  });
});

describe('normalizeDeviceBrowsers', () => {
  it('keeps the chosen devices only, in browser order, and Safari for iOS', () => {
    expect(
      normalizeDeviceBrowsers(['desktop', 'iphone'], {
        desktop: ['webkit', 'chromium', 'webkit'],
        android: ['firefox'],
      }),
    ).toEqual({ desktop: ['chromium', 'webkit'], iphone: ['webkit'] });
  });
});

describe('deviceBrowserProblems', () => {
  it('accepts a browser for every chosen device', () => {
    expect(deviceBrowserProblems(['desktop', 'iphone'], { desktop: ['firefox'] })).toEqual({});
  });

  it('asks for a browser for each device without one', () => {
    expect(deviceBrowserProblems(['desktop', 'android'], { desktop: [] })).toEqual({
      desktop: 'Mindestens einen Browser wählen.',
      android: 'Mindestens einen Browser wählen.',
    });
  });

  it('says that Android needs Chrome or Firefox', () => {
    expect(deviceBrowserProblems(['android'], { android: ['webkit'] })).toEqual({
      android: 'Android gibt es nur mit Chrome oder Firefox.',
    });
  });
});

describe('deviceBrowsersSchema', () => {
  it('takes browsers by device, for some devices only', () => {
    expect(deviceBrowsersSchema.parse({ desktop: ['chromium'] })).toEqual({
      desktop: ['chromium'],
    });
  });

  it('refuses unknown devices and browsers', () => {
    expect(deviceBrowsersSchema.safeParse({ fridge: ['chromium'] }).success).toBe(false);
    expect(deviceBrowsersSchema.safeParse({ desktop: ['opera'] }).success).toBe(false);
  });
});
