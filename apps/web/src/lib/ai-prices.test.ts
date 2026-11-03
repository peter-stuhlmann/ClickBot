import { describe, expect, it } from 'vitest';
import { priceText, readPriceForm } from './ai-prices';

describe('readPriceForm', () => {
  it('reads input and output, and a cached price when there is one', () => {
    expect(readPriceForm({ input: '3,50', output: '15', cached: '0,3' })).toEqual({
      input: 3.5,
      output: 15,
      cached: 0.3,
    });
  });

  it('takes an empty cached price as none: cached tokens then cost the input price', () => {
    expect(readPriceForm({ input: '3', output: '15', cached: '' })).toEqual({
      input: 3,
      output: 15,
      cached: null,
    });
  });

  it('removes the price when all three fields are empty', () => {
    expect(readPriceForm({ input: ' ', output: '', cached: '' })).toEqual({ remove: true });
  });

  it('asks for input and output when only one of them is filled', () => {
    expect(readPriceForm({ input: '3', output: '', cached: '' })).toEqual({
      errors: { output: 'Bitte ausfüllen.' },
    });
    expect(readPriceForm({ input: '', output: '', cached: '1' })).toEqual({
      errors: { input: 'Bitte ausfüllen.', output: 'Bitte ausfüllen.' },
    });
  });

  it('names every field that is not a price, at once', () => {
    const result = readPriceForm({ input: 'drei', output: '-1', cached: '1e3' });
    expect(result).toEqual({
      errors: {
        input: expect.stringContaining('Bitte eine Zahl'),
        output: expect.stringContaining('Bitte eine Zahl'),
        cached: expect.stringContaining('Bitte eine Zahl'),
      },
    });
  });
});

describe('priceText', () => {
  it('writes a stored price with a decimal comma, and nothing for none', () => {
    expect(priceText(3.5)).toBe('3,5');
    expect(priceText(15)).toBe('15');
    expect(priceText(0.075)).toBe('0,075');
    expect(priceText(null)).toBe('');
  });
});
