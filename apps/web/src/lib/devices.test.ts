import { describe, expect, it } from 'vitest';
import { DEVICE_OPTIONS, deviceLabel } from './devices';

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
});
