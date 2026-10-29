import { describe, expect, it } from 'vitest';
import {
  BROWSER_OPTIONS,
  DEVICE_OPTIONS,
  describeTargets,
  deviceLabel,
  toggleBrowser,
  toggleDevice,
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

  it('adds and removes devices in the order of the cards', () => {
    expect(toggleDevice(['ipad'], 'desktop')).toEqual(['desktop', 'ipad']);
    expect(toggleDevice(['desktop', 'ipad'], 'desktop')).toEqual(['ipad']);
  });

  it('says which browser engine each device really uses', () => {
    expect(DEVICE_OPTIONS.map((option) => option.spec)).toEqual([
      '1440 × 900 · Maus · in jedem Browser',
      '393 × 659 · Touch · immer Safari (WebKit)',
      '412 × 839 · Touch · Chrome oder Firefox',
      '656 × 944 · Touch · immer Safari (WebKit)',
    ]);
  });
});

describe('browsers', () => {
  it('offers Chrome, Firefox and Safari', () => {
    expect(BROWSER_OPTIONS.map((option) => option.label)).toEqual(['Chrome', 'Firefox', 'Safari']);
  });

  it('names what a job runs on, device with browser', () => {
    expect(describeTargets(['desktop', 'iphone'], ['chromium', 'firefox'])).toBe(
      'Desktop (Chrome), Desktop (Firefox), iPhone 15 (Safari)',
    );
    expect(describeTargets([], ['chromium'])).toBe('');
  });

  it('adds and removes browsers in the order of the cards', () => {
    expect(toggleBrowser(['webkit'], 'chromium')).toEqual(['chromium', 'webkit']);
    expect(toggleBrowser(['chromium', 'webkit'], 'chromium')).toEqual(['webkit']);
  });
});
