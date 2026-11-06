import { AI_PROVIDERS, type AiProviderKind, type AiUsage } from '@click-bot/shared';

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

/** A tool the model may call: a name, what it does and the JSON schema of its arguments. */
export type AiTool = { name: string; description: string; parameters: Record<string, unknown> };

/** What the model answered when it had to call a tool; `text` is any text beside the call. */
export type AiToolAnswer = {
  call: { name: string; args: Record<string, unknown> } | null;
  text: string;
};

export type AiClient = {
  /** Whether this provider takes tools; if not, `completeWithTools` is not available. */
  supportsTools?: boolean;
  /**
   * Asks for exactly one call of one of `tools` (the provider is told it must call one). The
   * arguments come back parsed. Only if `supportsTools`. Throws AiError like `complete`.
   */
  completeWithTools?(request: AiRequest, tools: readonly AiTool[]): Promise<AiToolAnswer>;
  /** The model's text answer. Throws AiError with a German message for the report or the UI. */
  complete(request: AiRequest): Promise<string>;
  /** The provider's models, or null if it cannot list them (Perplexity). */
  listModels(): Promise<string[] | null>;
};

export type AiDeps = {
  /** Told the tokens of every answer that reports them, e.g. to add up the cost of a run. */
  onUsage?: (usage: AiUsage) => void;
  fetch?: typeof globalThis.fetch;
  /** Per request; default 60 s. */
  timeoutMs?: number;
};

/** A problem with the provider, worded for the user. Never contains the API key. */
export class AiError extends Error {
  /**
   * The provider refused the request because of its tools (HTTP 400/422 on a request with
   * tools), e.g. OpenAI for a reasoning model: the caller can ask again without them.
   */
  toolsUnsupported = false;

  constructor(
    message: string,
    /** The HTTP status of the provider's answer, if the error comes from one. */
    readonly status?: number,
  ) {
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

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/**
 * The tokens an answer reports, in one shape. `inputTokens` are those billed at the full input
 * price, so cached ones are taken out where the provider counts them in (OpenAI, Gemini). Null if
 * the answer reports nothing (some compatible APIs, e.g. Ollama in some versions).
 */
export function usageOf(kind: AiProviderKind, data: Json): AiUsage | null {
  if (kind === 'anthropic') {
    const usage = asRecord(data.usage);
    if (Object.keys(usage).length === 0) return null;
    return {
      // Writing the cache costs more than input, but only a little; counted as input.
      inputTokens: count(usage.input_tokens) + count(usage.cache_creation_input_tokens),
      outputTokens: count(usage.output_tokens),
      cachedTokens: count(usage.cache_read_input_tokens),
    };
  }
  if (kind === 'gemini') {
    const usage = asRecord(data.usageMetadata);
    if (Object.keys(usage).length === 0) return null;
    const cached = count(usage.cachedContentTokenCount);
    return {
      inputTokens: Math.max(0, count(usage.promptTokenCount) - cached),
      // "Thinking" tokens are billed as output.
      outputTokens: count(usage.candidatesTokenCount) + count(usage.thoughtsTokenCount),
      cachedTokens: cached,
    };
  }
  const usage = asRecord(data.usage);
  if (Object.keys(usage).length === 0) return null;
  const cached = count(asRecord(usage.prompt_tokens_details).cached_tokens);
  return {
    inputTokens: Math.max(0, count(usage.prompt_tokens) - cached),
    outputTokens: count(usage.completion_tokens),
    cachedTokens: cached,
  };
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

function bodyFor(config: AiConfig, request: AiRequest, tools?: readonly AiTool[]): HttpRequest {
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
          // With tools the system prompt and the tools never change between rounds: marked, so
          // Claude can serve them from its cache (cheaper, faster) from the second round on.
          ...(system
            ? {
                system: tools
                  ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
                  : system,
              }
            : {}),
          ...(tools
            ? {
                tools: tools.map((tool, index) => ({
                  name: tool.name,
                  description: tool.description,
                  input_schema: tool.parameters,
                  ...(index === tools.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
                })),
                tool_choice: { type: 'any' },
              }
            : {}),
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
          ...(tools
            ? {
                tools: [
                  {
                    functionDeclarations: tools.map((tool) => ({
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.parameters,
                    })),
                  },
                ],
                toolConfig: { functionCallingConfig: { mode: 'ANY' } },
              }
            : {}),
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
          ...(tools
            ? {
                tools: tools.map((tool) => ({
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  },
                })),
                tool_choice: 'required',
              }
            : {}),
        },
      };
  }
}

/**
 * The first tool call of an answer, its arguments parsed. Claude and Gemini send them as an
 * object, OpenAI as a JSON string. Null if the model answered without calling a tool.
 */
export function toolCallOf(kind: AiProviderKind, data: Json): AiToolAnswer['call'] {
  if (kind === 'anthropic') {
    const block = asArray(data.content)
      .map((item) => asRecord(item))
      .find((item) => item.type === 'tool_use');
    return block ? { name: String(block.name ?? ''), args: asRecord(block.input) } : null;
  }
  if (kind === 'gemini') {
    const [candidate] = asArray(data.candidates);
    const part = asArray(asRecord(asRecord(candidate).content).parts)
      .map((item) => asRecord(item))
      .find((item) => item.functionCall !== undefined);
    const call = asRecord(part?.functionCall);
    return part ? { name: String(call.name ?? ''), args: asRecord(call.args) } : null;
  }
  const [choice] = asArray(data.choices);
  const [call] = asArray(asRecord(asRecord(choice).message).tool_calls);
  if (call === undefined) return null;
  const fn = asRecord(asRecord(call).function);
  const raw = fn.arguments;
  let args: Json = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      args = asRecord(JSON.parse(raw));
    } catch {
      throw new AiError(
        'Die KI hat die Argumente ihres Aufrufs nicht als gültiges JSON geliefert.',
      );
    }
  } else {
    args = asRecord(raw);
  }
  return { name: String(fn.name ?? ''), args };
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
        throw new AiError(
          `${label} lehnt den API-Schlüssel ab (HTTP ${response.status}).`,
          response.status,
        );
      }
      if (response.status === 429) {
        throw new AiError(`${label}: Limit erreicht (HTTP 429). Später erneut versuchen.`, 429);
      }
      if (!response.ok) {
        throw new AiError(
          mask(`${label} antwortet mit HTTP ${response.status}: ${providerMessage(text)}`),
          response.status,
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

  // Some models refuse tools although the provider has them (OpenAI reasoning models in Chat
  // Completions). After such a refusal this client no longer offers them.
  let toolsRefused = false;

  return {
    get supportsTools() {
      return AI_PROVIDERS[config.kind].toolCalling && !toolsRefused;
    },
    async completeWithTools(request, tools) {
      if (!AI_PROVIDERS[config.kind].toolCalling) {
        throw new AiError(`${label} unterstützt keine Funktionsaufrufe.`);
      }
      let data: Json;
      try {
        data = await send(bodyFor(config, request, tools));
      } catch (error) {
        if (error instanceof AiError && (error.status === 400 || error.status === 422)) {
          toolsRefused = true;
          error.toolsUnsupported = true;
        }
        throw error;
      }
      const usage = usageOf(config.kind, data);
      if (usage) deps.onUsage?.(usage);
      return { call: toolCallOf(config.kind, data), text: textOf(config.kind, data) };
    },
    async complete(request) {
      const data = await send(bodyFor(config, request));
      // Counted even if the text is empty: the provider bills it either way.
      const usage = usageOf(config.kind, data);
      if (usage) deps.onUsage?.(usage);
      const text = textOf(config.kind, data);
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
