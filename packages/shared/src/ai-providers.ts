import { z } from 'zod';

/** The AI providers Click-Bot can talk to. "custom" is any OpenAI-compatible API (e.g. Ollama). */
export const AI_PROVIDER_KINDS = ['gemini', 'openai', 'perplexity', 'anthropic', 'custom'] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export type AiProviderInfo = {
  label: string;
  /** Where its API lives; null for "custom", whose address the user enters. */
  defaultBaseUrl: string | null;
  /** Without a key only a custom endpoint works, e.g. a local model. */
  keyRequired: boolean;
  /** Offered in the model field when the provider cannot list its models. */
  modelSuggestions: readonly string[];
  /** Where to get a key, shown as a hint. */
  keyHelp: string;
};

export const AI_PROVIDERS: Record<AiProviderKind, AiProviderInfo> = {
  gemini: {
    label: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyRequired: true,
    modelSuggestions: [],
    keyHelp: 'Google AI Studio → API-Schlüssel',
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyRequired: true,
    modelSuggestions: [],
    keyHelp: 'platform.openai.com → API keys',
  },
  perplexity: {
    label: 'Perplexity',
    defaultBaseUrl: 'https://api.perplexity.ai',
    keyRequired: true,
    // Perplexity has no endpoint that lists its models.
    modelSuggestions: ['sonar', 'sonar-pro', 'sonar-reasoning-pro'],
    keyHelp: 'perplexity.ai → Settings → API',
  },
  anthropic: {
    label: 'Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyRequired: true,
    modelSuggestions: [],
    keyHelp: 'console.anthropic.com → API Keys',
  },
  custom: {
    label: 'Custom',
    defaultBaseUrl: null,
    keyRequired: false,
    modelSuggestions: [],
    keyHelp: 'Nur nötig, wenn die API einen Schlüssel verlangt.',
  },
};

const BASE_URL_HINT = 'Bitte die Adresse der API angeben, z. B. http://localhost:11434/v1.';

const trimSlash = (url: string | null | undefined) => (url ?? '').replace(/\/+$/, '');

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * A provider as entered in "Einstellungen → KI & API". An empty key means "keep the stored
 * one"; whether a key is needed at all is decided where the stored one is known.
 */
export const aiProviderInputSchema = z
  .object({
    kind: z.enum(AI_PROVIDER_KINDS),
    model: z.string().trim().min(1, 'Bitte ausfüllen.').max(200),
    apiKey: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((key) => key || undefined),
    baseUrl: z.string().trim().nullish(),
  })
  .refine((input) => input.kind !== 'custom' || isHttpUrl(trimSlash(input.baseUrl)), {
    path: ['baseUrl'],
    message: BASE_URL_HINT,
    // Also when e.g. the model is missing, so the form shows every problem at once.
    when: (payload) => !payload.issues.some((issue) => issue.path?.[0] === 'kind'),
  })
  .transform((input) => ({
    ...input,
    baseUrl: input.kind === 'custom' ? trimSlash(input.baseUrl) : null,
  }));

export type AiProviderInput = z.input<typeof aiProviderInputSchema>;
export type AiProviderSettings = z.output<typeof aiProviderInputSchema>;

/** "…1234": enough to recognise a stored key, too little to use it. */
export function keyHint(key: string): string {
  return key.length >= 12 ? `…${key.slice(-4)}` : '…';
}
