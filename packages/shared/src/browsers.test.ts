import { describe, expect, it } from 'vitest';
import { BROWSER_KINDS, BROWSERS, browserProblem, runTargets } from './browsers';

describe('BROWSERS', () => {
  it('offers Chrome, Firefox and Safari, by the names users know', () => {
    expect(BROWSER_KINDS.map((kind) => BROWSERS[kind].label)).toEqual([
      'Chrome',
      'Firefox',
      'Safari',
    ]);
  });
});

describe('runTargets', () => {
  it('runs a desktop in every chosen browser', () => {
    expect(runTargets(['desktop'], ['chromium', 'webkit'])).toEqual([
      { device: 'desktop', browser: 'chromium' },
      { device: 'desktop', browser: 'webkit' },
    ]);
  });

  it('runs iPhone and iPad once in Safari, because every browser on iOS is WebKit', () => {
    expect(runTargets(['iphone', 'ipad'], ['chromium', 'firefox'])).toEqual([
      { device: 'iphone', browser: 'webkit' },
      { device: 'ipad', browser: 'webkit' },
    ]);
  });

  it('runs Android in Chrome and Firefox, but not in Safari, which does not exist there', () => {
    expect(runTargets(['android'], ['webkit', 'firefox', 'chromium'])).toEqual([
      { device: 'android', browser: 'chromium' },
      { device: 'android', browser: 'firefox' },
    ]);
  });

  it('keeps the order of the devices, then of the browsers, and ignores repetitions', () => {
    expect(
      runTargets(['iphone', 'desktop', 'desktop'], ['firefox', 'chromium', 'firefox']),
    ).toEqual([
      { device: 'iphone', browser: 'webkit' },
      { device: 'desktop', browser: 'chromium' },
      { device: 'desktop', browser: 'firefox' },
    ]);
  });

  it('has nothing to run without devices', () => {
    expect(runTargets([], ['chromium'])).toEqual([]);
  });
});

describe('browserProblem', () => {
  it('accepts every combination that runs at least once per device', () => {
    expect(browserProblem(['desktop', 'android'], ['firefox'])).toBeNull();
    expect(browserProblem(['iphone'], ['chromium'])).toBeNull();
  });

  it('asks for at least one browser', () => {
    expect(browserProblem(['desktop'], [])).toBe('Mindestens einen Browser wählen.');
  });

  it('says that Android needs Chrome or Firefox', () => {
    expect(browserProblem(['desktop', 'android'], ['webkit'])).toBe(
      'Android gibt es nur mit Chrome oder Firefox.',
    );
  });
});
