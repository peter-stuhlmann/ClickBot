import { describe, expect, it } from 'vitest';
import { AI_PROVIDER_KINDS, AI_PROVIDERS, aiProviderInputSchema, keyHint } from './ai-providers';

const messages = (input: unknown) =>
  aiProviderInputSchema
    .safeParse(input)
    .error?.issues.map((issue) => [issue.path.join('.'), issue.message]);

describe('AI_PROVIDERS', () => {
  it('lists Gemini, OpenAI, Perplexity, Claude and a custom endpoint, in this order', () => {
    expect(AI_PROVIDER_KINDS.map((kind) => AI_PROVIDERS[kind].label)).toEqual([
      'Gemini',
      'OpenAI',
      'Perplexity',
      'Claude',
      'Custom',
    ]);
  });

  it('has a fixed address for every provider except the custom one', () => {
    for (const kind of AI_PROVIDER_KINDS) {
      const { defaultBaseUrl } = AI_PROVIDERS[kind];
      if (kind === 'custom') expect(defaultBaseUrl).toBeNull();
      else expect(defaultBaseUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('aiProviderInputSchema', () => {
  it('accepts a provider with model and key', () => {
    expect(
      aiProviderInputSchema.parse({ kind: 'anthropic', model: ' claude-sonnet-5-5 ', apiKey: 'k' }),
    ).toEqual({ kind: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'k', baseUrl: null });
  });

  it('needs a model', () => {
    expect(messages({ kind: 'openai', model: ' ' })).toEqual([['model', 'Bitte ausfüllen.']]);
  });

  it('rejects unknown providers', () => {
    expect(messages({ kind: 'grok', model: 'x' })?.[0]?.[0]).toBe('kind');
  });

  it('ignores an address for providers with a fixed one', () => {
    expect(
      aiProviderInputSchema.parse({ kind: 'gemini', model: 'm', baseUrl: 'http://anders' }).baseUrl,
    ).toBeNull();
  });

  it('needs an http(s) address for a custom endpoint and drops a trailing slash', () => {
    expect(messages({ kind: 'custom', model: 'llama' })).toEqual([
      ['baseUrl', 'Bitte die Adresse der API angeben, z. B. http://localhost:11434/v1.'],
    ]);
    expect(messages({ kind: 'custom', model: 'llama', baseUrl: 'ftp://x' })).toEqual([
      ['baseUrl', 'Bitte die Adresse der API angeben, z. B. http://localhost:11434/v1.'],
    ]);
    expect(
      aiProviderInputSchema.parse({
        kind: 'custom',
        model: 'llama',
        baseUrl: ' http://localhost:11434/v1/ ',
      }).baseUrl,
    ).toBe('http://localhost:11434/v1');
  });

  it('treats an empty key as "keep the stored one"', () => {
    expect(aiProviderInputSchema.parse({ kind: 'openai', model: 'm', apiKey: '  ' }).apiKey).toBe(
      undefined,
    );
  });
});

describe('keyHint', () => {
  it('shows only the last four characters of a key', () => {
    expect(keyHint('sk-ant-abcdefgh1234')).toBe('…1234');
  });

  it('shows nothing of a short key', () => {
    expect(keyHint('abc12345')).toBe('…');
  });
});
