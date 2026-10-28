import { describe, expect, it } from 'vitest';
import { contextOptionsFor } from './devices';

describe('contextOptionsFor', () => {
  it('uses the desktop size of the design for desktop runs', () => {
    expect(contextOptionsFor('desktop')).toMatchObject({
      viewport: { width: 1440, height: 900 },
      isMobile: false,
    });
  });

  it.each([
    ['iphone', 'iPhone'],
    ['android', 'Android'],
    ['ipad', 'iPad'],
  ] as const)('emulates %s with a mobile user agent and touch', (device, agent) => {
    const options = contextOptionsFor(device);
    expect(options.hasTouch).toBe(true);
    expect(options.userAgent).toContain(agent);
  });

  it.each(['desktop', 'iphone', 'android', 'ipad'] as const)(
    'runs %s in German and in Berlin time',
    (device) => {
      expect(contextOptionsFor(device)).toMatchObject({
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
      });
    },
  );

  it('does not pass the browser type, because all devices run in the shared Chromium', () => {
    expect(contextOptionsFor('iphone')).not.toHaveProperty('defaultBrowserType');
  });
});
