import { describe, expect, it } from 'vitest';
import { addUsage, hasUsage, NO_USAGE, parsePrice, usageCost } from './ai-pricing';

const price = { inputPerMillion: 3, outputPerMillion: 15, cachedPerMillion: 0.3 };

describe('usageCost', () => {
  it('prices input, output and cached tokens each at their own rate and adds them up', () => {
    const cost = usageCost(
      { inputTokens: 200_000, outputTokens: 10_000, cachedTokens: 1_000_000 },
      price,
    );
    expect(cost.input).toBeCloseTo(0.6, 10);
    expect(cost.output).toBeCloseTo(0.15, 10);
    expect(cost.cached).toBeCloseTo(0.3, 10);
    expect(cost.total).toBeCloseTo(1.05, 10);
  });

  it('charges cached tokens the input price when the model has no cached price', () => {
    const cost = usageCost(
      { inputTokens: 0, outputTokens: 0, cachedTokens: 500_000 },
      { ...price, cachedPerMillion: null },
    );
    expect(cost.cached).toBeCloseTo(1.5, 10);
  });

  it('costs nothing without tokens', () => {
    expect(usageCost(NO_USAGE, price).total).toBe(0);
  });
});

describe('addUsage and hasUsage', () => {
  it('adds every kind of token and knows an empty usage', () => {
    const sum = addUsage(
      { inputTokens: 1, outputTokens: 2, cachedTokens: 3 },
      { inputTokens: 10, outputTokens: 20, cachedTokens: 30 },
    );
    expect(sum).toEqual({ inputTokens: 11, outputTokens: 22, cachedTokens: 33 });
    expect(hasUsage(sum)).toBe(true);
    expect(hasUsage(NO_USAGE)).toBe(false);
    expect(hasUsage({ ...NO_USAGE, cachedTokens: 1 })).toBe(true);
  });
});

describe('parsePrice', () => {
  it.each([
    ['3,50', 3.5],
    ['3.5', 3.5],
    [' 15 ', 15],
    ['0', 0],
    ['0,075', 0.075],
  ])('reads %s as %s', (text, value) => {
    expect(parsePrice(text)).toEqual({ value });
  });

  it('takes an empty field as no price', () => {
    expect(parsePrice('')).toEqual({ value: null });
    expect(parsePrice('   ')).toEqual({ value: null });
  });

  it.each(['abc', '-1', '1,2,3', '3 $', '1e3', '100001', ','])('rejects %s', (text) => {
    expect(parsePrice(text)).toEqual({ error: expect.stringContaining('Bitte eine Zahl') });
  });
});
