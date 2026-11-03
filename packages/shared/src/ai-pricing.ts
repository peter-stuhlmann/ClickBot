/**
 * What an AI call costs: the tokens a provider reports, the price per model, the sum.
 * Prices are US dollars per one million tokens, as the providers list them.
 */

/** Tokens of one or more calls. `inputTokens` are the ones billed at the full input price. */
export type AiUsage = {
  inputTokens: number;
  /** Includes the tokens the model "thought" where the provider bills them as output. */
  outputTokens: number;
  /** Input tokens the provider served from its cache (cheaper); not part of `inputTokens`. */
  cachedTokens: number;
};

export const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
  };
}

export function hasUsage(usage: AiUsage): boolean {
  return usage.inputTokens + usage.outputTokens + usage.cachedTokens > 0;
}

/** The price of a model in US dollars per million tokens. */
export type ModelPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
  /** Without a price of its own, cached tokens cost the input price. */
  cachedPerMillion: number | null;
};

export type UsageCost = { input: number; output: number; cached: number; total: number };

const PER_MILLION = 1_000_000;

export function usageCost(usage: AiUsage, price: ModelPrice): UsageCost {
  const input = (usage.inputTokens * price.inputPerMillion) / PER_MILLION;
  const output = (usage.outputTokens * price.outputPerMillion) / PER_MILLION;
  const cached =
    (usage.cachedTokens * (price.cachedPerMillion ?? price.inputPerMillion)) / PER_MILLION;
  return { input, output, cached, total: input + output + cached };
}

export const MAX_PRICE_PER_MILLION = 100_000;
const PRICE_MESSAGE = `Bitte eine Zahl zwischen 0 und ${MAX_PRICE_PER_MILLION.toLocaleString('de-DE')} eingeben, z. B. 3,50.`;

/**
 * A price typed in a form: "3,50" or "3.5". Empty is `null` (allowed only where a price is
 * optional, the caller decides); anything else that is not a price is an error to show.
 */
export function parsePrice(text: string): { value: number | null } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { value: null };
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return { error: PRICE_MESSAGE };
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value > MAX_PRICE_PER_MILLION) return { error: PRICE_MESSAGE };
  return { value };
}
