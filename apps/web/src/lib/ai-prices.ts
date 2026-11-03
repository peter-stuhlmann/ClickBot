import { parsePrice, type AiProviderKind } from '@click-bot/shared';

/** The prices as typed into the form of one model. */
export type PriceFields = { input: string; output: string; cached: string };

export type PriceFormResult =
  /** All three empty: the price of the model is removed. */
  | { remove: true }
  | { remove?: false; input: number; output: number; cached: number | null }
  | { errors: Partial<Record<keyof PriceFields, string>> };

/**
 * Reads the price fields of a model. Input and output are required; an empty cached price means
 * "like the input price". All three empty removes the price.
 */
export function readPriceForm(fields: PriceFields): PriceFormResult {
  if (!fields.input.trim() && !fields.output.trim() && !fields.cached.trim()) {
    return { remove: true };
  }
  const errors: Partial<Record<keyof PriceFields, string>> = {};
  const read = (key: keyof PriceFields, required: boolean): number | null => {
    const parsed = parsePrice(fields[key]);
    if ('error' in parsed) {
      errors[key] = parsed.error;
      return null;
    }
    if (parsed.value === null && required) errors[key] = 'Bitte ausfüllen.';
    return parsed.value;
  };
  const input = read('input', true);
  const output = read('output', true);
  const cached = read('cached', false);
  if (Object.keys(errors).length > 0 || input === null || output === null) return { errors };
  return { input, output, cached };
}

/** A stored price for an input field: German decimal comma, empty for none. */
export function priceText(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

export type ModelKey = { provider: AiProviderKind; model: string };
