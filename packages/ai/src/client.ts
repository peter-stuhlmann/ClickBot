import { AI_PROVIDERS, type AiProviderKind } from '@click-bot/shared';

/** A provider ready to use: the key is already decrypted. Never log this object. */
export type AiConfig = {
  kind: AiProviderKind;
  apiKey: string | null;
  model: string;
  /** Only for "custom"; the others have a fixed address. */
  baseUrl?: string | null;
};

/** A screenshot sent with a message, base64 without the data: prefix. */
export type AiImage = { mediaType: 'image/jpeg' | 'image/png'; data: string };

export type AiMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Needs a model that understands images. */
  images?: AiImage[];
};

export type AiRequest = {
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
};

export type AiClient = {
  /** The model's text answer. Throws AiError with a German message for the report or the UI. */
  complete(request: AiRequest): Promise<string>;
  /** The provider's models, or null if it cannot list them (Perplexity). */
  listModels(): Promise<string[] | null>;
};

export type AiDeps = {
  fetch?: typeof globalThis.fetch;
  /** Per request; default 60 s. */
  timeoutMs?: number;
};

/** A problem with the provider, worded for the user. Never contains the API key. */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 60_000;
const ANTHROPIC_VERSION = '2023-06-01';

type Json = Record<string, unknown>;
type HttpRequest = { path: string; method?: 'GET' | 'POST'; body?: Json };

function seconds(ms: number): string {
  return (ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim().slice(0, 300);
}

function asRecord(value: unknown): Json {
  return typeof value === 'object' && value !== null ? (value as Json) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The provider's own error message: `{ error: { message } }` for all of them, else the text. */
function providerMessage(text: string): string {
  try {
    const message = asRecord(asRecord(JSON.parse(text)).error).message;
    if (typeof message === 'string' && message.trim()) return firstLine(message);
  } catch {
    // Not JSON, e.g. an HTML error page of a proxy.
  }
  return firstLine(text);
}

function headersFor(config: AiConfig): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (!config.apiKey) return headers;
  if (config.kind === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  } else if (config.kind === 'gemini') {
    // In a header, not in the address as `?key=`, so it cannot end up in logs.
    headers['x-goog-api-key'] = config.apiKey;
  } else {
    headers.authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function textOf(kind: AiProviderKind, data: Json): string {
  if (kind === 'anthropic') {
    return asArray(data.content)
      .map((block) => asRecord(block))
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('');
  }
  if (kind === 'gemini') {
    const [candidate] = asArray(data.candidates);
    return asArray(asRecord(asRecord(candidate).content).parts)
      .map((part) => String(asRecord(part).text ?? ''))
      .join('');
  }
  const [choice] = asArray(data.choices);
  const content = asRecord(asRecord(choice).message).content;
  return typeof content === 'string' ? content : '';
}

/** A message in the provider's own format: images first for Claude and Gemini, after for OpenAI. */
function messageFor(kind: AiProviderKind, { role, content, images = [] }: AiMessage): Json {
  if (kind === 'gemini') {
    return {
      role: role === 'assistant' ? 'model' : 'user',
      parts: [
        ...images.map((image) => ({
          inline_data: { mime_type: image.mediaType, data: image.data },
        })),
        { text: content },
      ],
    };
  }
  if (images.length === 0) return { role, content };
  if (kind === 'anthropic') {
    return {
      role,
      content: [
        ...images.map((image) => ({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
        })),
        { type: 'text', text: content },
      ],
    };
  }
  return {
    role,
    content: [
      { type: 'text', text: content },
      ...images.map((image) => ({
        type: 'image_url',
        image_url: { url: `data:${image.mediaType};base64,${image.data}` },
      })),
    ],
  };
}

function bodyFor(config: AiConfig, request: AiRequest): HttpRequest {
  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
  const { system } = request;
  const messages = request.messages.map((message) => messageFor(config.kind, message));
  switch (config.kind) {
    case 'anthropic':
      return {
        path: '/messages',
        body: {
          model: config.model,
          max_tokens: maxTokens,
          ...(system ? { system } : {}),
          messages,
        },
      };
    case 'gemini':
      return {
        path: `/models/${encodeURIComponent(config.model.replace(/^models\//, ''))}:generateContent`,
        body: {
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: messages,
          generationConfig: { maxOutputTokens: maxTokens },
        },
      };
    default:
      return {
        path: '/chat/completions',
        body: {
          model: config.model,
          // OpenAI's newer models only accept max_completion_tokens; compatible APIs know max_tokens.
          [config.kind === 'openai' ? 'max_completion_tokens' : 'max_tokens']: maxTokens,
          messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        },
      };
  }
}

function modelsFrom(kind: AiProviderKind, data: Json): string[] {
  if (kind === 'gemini') {
    return asArray(data.models)
      .map((model) => asRecord(model))
      .filter((model) => asArray(model.supportedGenerationMethods).includes('generateContent'))
      .map((model) => String(model.name ?? '').replace(/^models\//, ''))
      .sort();
  }
  const ids = asArray(data.data).map((model) => String(asRecord(model).id ?? ''));
  // Anthropic lists its newest models first, which is the more useful order.
  return kind === 'anthropic' ? ids : ids.sort();
}

const MODELS_PATH: Partial<Record<AiProviderKind, string>> = {
  anthropic: '/models?limit=1000',
  gemini: '/models?pageSize=1000',
  openai: '/models',
  custom: '/models',
};

export function createAiClient(config: AiConfig, deps: AiDeps = {}): AiClient {
  const { label, defaultBaseUrl } = AI_PROVIDERS[config.kind];
  const baseUrl = config.kind === 'custom' ? config.baseUrl : defaultBaseUrl;
  if (!baseUrl) throw new AiError(`Für ${label} fehlt die Adresse der API.`);
  const fetch = deps.fetch ?? globalThis.fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const mask = (text: string) => (config.apiKey ? text.split(config.apiKey).join('••••') : text);

  async function send({ path, method = 'POST', body }: HttpRequest): Promise<Json> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiError(`${label} antwortet nicht (nach ${seconds(timeoutMs)} s).`));
      }, timeoutMs);
    });
    try {
      const response = await Promise.race([
        fetch(`${baseUrl}${path}`, {
          method,
          headers: headersFor(config),
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        }).catch((error: unknown) => {
          throw new AiError(
            mask(
              `${label} ist nicht erreichbar: ${firstLine(error instanceof Error ? error.message : String(error))}`,
            ),
          );
        }),
        timeout,
      ]);
      const text = await Promise.race([response.text(), timeout]);
      if (response.status === 401 || response.status === 403) {
        throw new AiError(`${label} lehnt den API-Schlüssel ab (HTTP ${response.status}).`);
      }
      if (response.status === 429) {
        throw new AiError(`${label}: Limit erreicht (HTTP 429). Später erneut versuchen.`);
      }
      if (!response.ok) {
        throw new AiError(
          mask(`${label} antwortet mit HTTP ${response.status}: ${providerMessage(text)}`),
        );
      }
      try {
        return asRecord(JSON.parse(text));
      } catch {
        throw new AiError(`${label} hat keine gültige Antwort geliefert.`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async complete(request) {
      const text = textOf(config.kind, await send(bodyFor(config, request)));
      if (!text.trim()) throw new AiError(`${label} hat keine Antwort geliefert.`);
      return text;
    },
    async listModels() {
      const path = MODELS_PATH[config.kind];
      if (!path) return null;
      return modelsFrom(config.kind, await send({ path, method: 'GET' }));
    },
  };
}

export type ConnectionResult = {
  /** What the model field can offer; null if the provider cannot list its models. */
  models: string[] | null;
  /** Whether the provider knows the entered model; null if that cannot be told. */
  modelKnown: boolean | null;
};

/** "Verbindung testen": checks address and key with as little cost as possible. */
export async function testAiConnection(
  config: AiConfig,
  deps: AiDeps = {},
): Promise<ConnectionResult> {
  const model = config.model.trim();
  const client = createAiClient(
    { ...config, model: model || (AI_PROVIDERS[config.kind].modelSuggestions[0] ?? '') },
    deps,
  );
  const models = await client.listModels();
  if (models) return { models, modelKnown: model ? models.includes(model) : null };
  await client.complete({
    messages: [{ role: 'user', content: 'Antworte nur mit OK.' }],
    maxTokens: 5,
  });
  return { models: null, modelKnown: null };
}
