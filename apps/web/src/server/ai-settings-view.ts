import 'server-only';
import type { AiProviderListing } from '@click-bot/db';
import { AI_PROVIDER_KINDS, AI_PROVIDERS } from '@click-bot/shared';
import type { AiProviderView } from '@/lib/views';

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
