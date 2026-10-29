import { describe, expect, it } from 'vitest';
import { contextOptionsFor } from './devices';

describe('contextOptionsFor', () => {
  it('uses the desktop size of the design for desktop runs, in every browser', () => {
    for (const browser of ['chromium', 'firefox', 'webkit'] as const) {
      expect(contextOptionsFor('desktop', browser, '1.0')).toMatchObject({
        viewport: { width: 1440, height: 900 },
        isMobile: false,
      });
    }
  });

  it('keeps the browser’s own user agent on the desktop', () => {
    expect(contextOptionsFor('desktop', 'firefox', '157.0')).not.toHaveProperty('userAgent');
  });

  it.each([
    ['iphone', 'webkit', 'iPhone'],
    ['ipad', 'webkit', 'iPad'],
    ['android', 'chromium', 'Android'],
  ] as const)('emulates %s in %s with a mobile user agent and touch', (device, browser, agent) => {
    const options = contextOptionsFor(device, browser, '1.0');
    expect(options).toMatchObject({ hasTouch: true, isMobile: true });
    expect(options.userAgent).toContain(agent);
  });

  it('announces Android in Firefox as Firefox for Android, with the version that runs', () => {
    const options = contextOptionsFor('android', 'firefox', '157.0');
    expect(options.userAgent).toBe(
      'Mozilla/5.0 (Android 14; Mobile; rv:157.0) Gecko/157.0 Firefox/157.0',
    );
    expect(options).toMatchObject({ hasTouch: true, viewport: { width: 412, height: 839 } });
    // Playwright does not support it in Firefox: clicks wait forever for a stable element.
    expect(options).not.toHaveProperty('isMobile');
  });

  it.each(['desktop', 'iphone', 'android', 'ipad'] as const)(
    'runs %s in German and in Berlin time',
    (device) => {
      expect(contextOptionsFor(device, 'chromium', '1.0')).toMatchObject({
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
      });
    },
  );

  it('does not pass the browser type, which the worker picks itself', () => {
    expect(contextOptionsFor('iphone', 'webkit', '1.0')).not.toHaveProperty('defaultBrowserType');
  });
});
