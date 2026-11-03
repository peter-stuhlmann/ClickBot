import 'server-only';
import type { AiProviderListing, ModelPriceRow } from '@click-bot/db';
import { AI_PROVIDER_KINDS, AI_PROVIDERS } from '@click-bot/shared';
import { priceText } from '@/lib/ai-prices';
import type { AiProviderView, ModelPriceView } from '@/lib/views';

/** All providers in the order of the settings page, set up or not. */
export function toAiProviderViews(listing: AiProviderListing[]): AiProviderView[] {
  return AI_PROVIDER_KINDS.map((kind) => {
    const info = AI_PROVIDERS[kind];
    const stored = listing.find((provider) => provider.kind === kind);
    return {
      kind,
      label: info.label,
      keyHelp: info.keyHelp,
      configured: stored !== undefined,
      isDefault: stored?.isDefault ?? false,
      model: stored?.model ?? '',
      needsBaseUrl: kind === 'custom',
      baseUrl: stored?.baseUrl ?? '',
      keyRequired: info.keyRequired,
      keyHint: stored?.keyHint ?? null,
      modelSuggestions: [...info.modelSuggestions],
    };
  });
}

/** The models a price can be kept for, each with its price (empty where there is none). */
export function toModelPriceViews(
  models: readonly { provider: ModelPriceRow['provider']; model: string }[],
  prices: readonly ModelPriceRow[],
): ModelPriceView[] {
  return models.map(({ provider, model }) => {
    const price = prices.find((row) => row.provider === provider && row.model === model);
    return {
      provider,
      providerLabel: AI_PROVIDERS[provider].label,
      model,
      input: priceText(price?.inputPerMillion ?? null),
      output: priceText(price?.outputPerMillion ?? null),
      cached: priceText(price?.cachedPerMillion ?? null),
      priced: price !== undefined,
    };
  });
}
