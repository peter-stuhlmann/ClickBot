import { describe, expect, it } from 'vitest';
import { DEVICE_OPTIONS, deviceLabel, toggleDevice } from './devices';

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
});
