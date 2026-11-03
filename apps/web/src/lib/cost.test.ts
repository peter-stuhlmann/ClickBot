import { describe, expect, it } from 'vitest';
import { toCostView } from './cost';

const usage = { inputTokens: 200_000, outputTokens: 10_000, cachedTokens: 1_000_000 };
const claude = { provider: 'anthropic' as const, model: 'claude-x', usage };
const price = {
  provider: 'anthropic' as const,
  model: 'claude-x',
  inputPerMillion: 3,
  outputPerMillion: 15,
  cachedPerMillion: 0.3,
};

describe('toCostView', () => {
  it('shows input, output and cached tokens each with its price, and the total', () => {
    const view = toCostView([claude], [price]);
    expect(view.model).toBe('Claude · claude-x');
    expect(view.rows).toEqual([
      { label: 'Eingabe', tokens: '200.000', price: '0,60\u00a0$' },
      { label: 'Ausgabe', tokens: '10.000', price: '0,15\u00a0$' },
      { label: 'Zwischengespeichert', tokens: '1.000.000', price: '0,30\u00a0$' },
    ]);
    expect(view.total).toBe('1,05\u00a0$');
    expect(view.note).toBeNull();
  });

  it('leaves out the cached row when the provider reported none', () => {
    const view = toCostView([{ ...claude, usage: { ...usage, cachedTokens: 0 } }], [price]);
    expect(view.rows.map((row) => row.label)).toEqual(['Eingabe', 'Ausgabe']);
    expect(view.total).toBe('0,75\u00a0$');
  });

  it('shows small amounts with up to four decimals', () => {
    const view = toCostView(
      [{ ...claude, usage: { inputTokens: 1234, outputTokens: 0, cachedTokens: 0 } }],
      [price],
    );
    expect(view.rows[0]?.price).toBe('0,0037\u00a0$');
  });

  it('says so, with the tokens, when the model has no price yet', () => {
    const view = toCostView([claude], []);
    expect(view.rows[0]).toEqual({ label: 'Eingabe', tokens: '200.000', price: '–' });
    expect(view.total).toBe('–');
    expect(view.note).toContain('Kein Preis hinterlegt für Claude · claude-x');
  });

  it('adds the models of a test that ran with two, and marks a total with a gap as "mind."', () => {
    const gemini = {
      provider: 'gemini' as const,
      model: 'gemini-x',
      usage: { ...usage, cachedTokens: 0 },
    };
    const both = toCostView(
      [claude, gemini],
      [price, { ...price, provider: 'gemini', model: 'gemini-x', cachedPerMillion: null }],
    );
    expect(both.model).toBe('2 Modelle');
    expect(both.total).toBe('1,80\u00a0$');
    const gap = toCostView([claude, gemini], [price]);
    expect(gap.total).toBe('mind. 1,05\u00a0$');
    expect(gap.note).toContain('Gemini · gemini-x');
    expect(gap.note).not.toContain('Claude');
  });

  it('has no cost for a test without AI', () => {
    const view = toCostView([], [price]);
    expect(view).toMatchObject({ model: null, rows: [], total: '–' });
    expect(view.note).toBe('Kein KI-Aufruf, also keine Kosten.');
    expect(
      toCostView(
        [{ ...claude, usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 } }],
        [price],
      ).rows,
    ).toEqual([]);
  });
});
