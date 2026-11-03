import {
  AI_PROVIDERS,
  addUsage,
  hasUsage,
  NO_USAGE,
  usageCost,
  type AiProviderKind,
  type AiUsage,
  type ModelPrice,
} from '@click-bot/shared';
import type { CostView } from './views';

type Entry = { provider: AiProviderKind; model: string; usage: AiUsage };
type PriceRow = ModelPrice & { provider: AiProviderKind; model: string };

const DASH = '–';

/** For a run whose cost is not known (yet): shown as a test without AI. */
export const NO_AI_COST: CostView = {
  model: null,
  rows: [],
  total: DASH,
  note: 'Kein KI-Aufruf, also keine Kosten.',
};
const money = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatMoney = (value: number): string => money.format(value);
export const formatTokens = (value: number): string => value.toLocaleString('de-DE');

const modelName = ({ provider, model }: { provider: AiProviderKind; model: string }) =>
  `${AI_PROVIDERS[provider].label} · ${model}`;

/**
 * The cost of the tokens of one or more runs. Each model is priced with its own price, so a job
 * that ran with two models adds both. A model without a price is left out of the sums and named
 * in the note, so the total is never taken for the whole cost.
 */
export function toCostView(entries: readonly Entry[], prices: readonly PriceRow[]): CostView {
  const used = entries.filter((entry) => hasUsage(entry.usage));
  if (used.length === 0) {
    return NO_AI_COST;
  }

  const priceOf = (entry: Entry) =>
    prices.find((price) => price.provider === entry.provider && price.model === entry.model);
  const priced = used.flatMap((entry) => {
    const price = priceOf(entry);
    return price ? [{ entry, cost: usageCost(entry.usage, price) }] : [];
  });
  const unpriced = used.filter((entry) => !priceOf(entry));

  const tokens = used.reduce((sum, entry) => addUsage(sum, entry.usage), NO_USAGE);
  const sum = (key: 'input' | 'output' | 'cached' | 'total') =>
    priced.reduce((total, { cost }) => total + cost[key], 0);
  const price = (key: 'input' | 'output' | 'cached') =>
    priced.length > 0 ? formatMoney(sum(key)) : DASH;

  const rows = [
    { label: 'Eingabe', tokens: formatTokens(tokens.inputTokens), price: price('input') },
    { label: 'Ausgabe', tokens: formatTokens(tokens.outputTokens), price: price('output') },
    // Only where a provider reported cached tokens; we do not cache anything ourselves.
    ...(tokens.cachedTokens > 0
      ? [
          {
            label: 'Zwischengespeichert',
            tokens: formatTokens(tokens.cachedTokens),
            price: price('cached'),
          },
        ]
      : []),
  ];

  const names = [...new Set(used.map(modelName))];
  return {
    model: names.length === 1 ? (names[0] as string) : `${names.length} Modelle`,
    rows,
    total:
      priced.length === 0
        ? DASH
        : `${unpriced.length > 0 ? 'mind. ' : ''}${formatMoney(sum('total'))}`,
    note:
      unpriced.length > 0
        ? `Kein Preis hinterlegt für ${[...new Set(unpriced.map(modelName))].join(', ')}. Unter „Einstellungen → KI & API“ eintragen.`
        : null,
  };
}
