import { describe, expect, it } from 'vitest';
import { TEST_DATA_KEYS, createTestData } from './test-data';

describe('createTestData', () => {
  it('returns the same value for the same key within one run', () => {
    const data = createTestData(7, 3);
    expect(data('email')).toBe(data('email'));
  });

  it('is reproducible: the same run and bot get the same data again', () => {
    expect(createTestData(7, 3)('name')).toBe(createTestData(7, 3)('name'));
  });

  it('gives different bots of one wave different data', () => {
    const names = new Set([1, 2, 3, 4, 5, 6].map((bot) => createTestData(7, bot)('email')));
    expect(names.size).toBe(6);
  });

  it('uses safe example domains for e-mail addresses, so tests never mail real people', () => {
    for (let bot = 1; bot <= 20; bot++) {
      expect(createTestData(1, bot)('email')).toMatch(/@example\.(com|org|net)$/);
    }
  });

  it.each(TEST_DATA_KEYS)('provides a non-empty value for %s', (key) => {
    expect(createTestData(1, 1)(key)).toMatch(/\S/);
  });

  it('returns undefined for keys it does not know', () => {
    expect(createTestData(1, 1)('iban')).toBeUndefined();
  });
});
