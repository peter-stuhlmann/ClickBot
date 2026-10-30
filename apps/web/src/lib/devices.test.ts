import { describe, expect, it } from 'vitest';
import {
  DEVICE_OPTIONS,
  browserChoices,
  describeTargets,
  deviceLabel,
  toggleDevice,
  toggleDeviceBrowser,
} from './devices';

describe('devices', () => {
  it('offers the four devices the worker can emulate', () => {
    expect(DEVICE_OPTIONS.map((option) => option.key)).toEqual([
      'desktop',
      'iphone',
      'android',
      'ipad',
    ]);
  });

  it('names a device for the summary', () => {
    expect(deviceLabel('iphone')).toBe('iPhone 15');
  });

  it('falls back to the key for a device it does not know', () => {
    expect(deviceLabel('watch' as never)).toBe('watch');
  });

  it('describes screen and input of each device', () => {
    expect(DEVICE_OPTIONS.map((option) => option.spec)).toEqual([
      '1440 × 900 · Maus',
      '393 × 659 · Touch',
      '412 × 839 · Touch',
      '656 × 944 · Touch',
    ]);
  });
});

describe('toggleDevice', () => {
  it('adds and removes devices in the order of the cards', () => {
    expect(toggleDevice(['ipad'], {}, 'desktop').devices).toEqual(['desktop', 'ipad']);
    expect(toggleDevice(['desktop', 'ipad'], {}, 'desktop').devices).toEqual(['ipad']);
  });

  it('starts a newly chosen device in its default browser', () => {
    expect(toggleDevice([], {}, 'android').deviceBrowsers).toEqual({ android: ['chromium'] });
    expect(toggleDevice([], {}, 'iphone').deviceBrowsers).toEqual({ iphone: ['webkit'] });
  });

  it('remembers the browsers of a device that is switched off and on again', () => {
    const off = toggleDevice(['android'], { android: ['firefox'] }, 'android');
    expect(off).toEqual({ devices: [], deviceBrowsers: { android: ['firefox'] } });
    expect(toggleDevice(off.devices, off.deviceBrowsers, 'android').deviceBrowsers).toEqual({
      android: ['firefox'],
    });
  });

  it('gives a device back its default browser when all of them were switched off', () => {
    expect(toggleDevice([], { desktop: [] }, 'desktop').deviceBrowsers).toEqual({
      desktop: ['chromium'],
    });
  });
});

describe('browsers per device', () => {
  it('adds and removes a browser of one device, in browser order', () => {
    expect(toggleDeviceBrowser({ desktop: ['webkit'] }, 'desktop', 'chromium')).toEqual({
      desktop: ['chromium', 'webkit'],
    });
    expect(
      toggleDeviceBrowser({ desktop: ['chromium'], android: ['firefox'] }, 'desktop', 'chromium'),
    ).toEqual({ desktop: [], android: ['firefox'] });
  });

  it('offers each device its possible browsers, chosen or not, and locks iOS to Safari', () => {
    expect(browserChoices('android', { android: ['firefox'] })).toEqual({
      locked: false,
      browsers: [
        { key: 'chromium', label: 'Chrome', chosen: false },
        { key: 'firefox', label: 'Firefox', chosen: true },
      ],
    });
    expect(browserChoices('ipad', {})).toEqual({
      locked: true,
      browsers: [{ key: 'webkit', label: 'Safari', chosen: true }],
    });
  });

  it('names what a job runs on, device with browser', () => {
    expect(
      describeTargets(['desktop', 'iphone', 'android'], {
        desktop: ['chromium', 'firefox'],
        android: ['firefox'],
      }),
    ).toBe('Desktop (Chrome), Desktop (Firefox), iPhone 15 (Safari), Android (Pixel 8) (Firefox)');
    expect(describeTargets([], { desktop: ['chromium'] })).toBe('');
  });
});
