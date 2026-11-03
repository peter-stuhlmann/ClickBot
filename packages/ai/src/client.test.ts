import { describe, expect, it } from 'vitest';
import { AiError, createAiClient, testAiConnection, usageOf, type AiConfig } from './client';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** Stands in for the provider's API: records each request and answers with `reply`. */
function fakeApi(reply: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return reply(call);
  };
  return { fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const KEY = 'sk-test-geheim-0815';
const request = {
  system: 'Du testest Websites.',
  messages: [
    { role: 'user' as const, content: 'Hallo' },
    { role: 'assistant' as const, content: 'Hi' },
    { role: 'user' as const, content: 'Und jetzt?' },
  ],
  maxTokens: 300,
};

describe('screenshots with a message', () => {
  const PNG = 'iVBORw0KGgo=';
  const withImage = {
    messages: [
      {
        role: 'user' as const,
        content: 'Ist der Knopf blau?',
        images: [{ mediaType: 'image/jpeg' as const, data: PNG }],
      },
    ],
  };
  const answer = {
    anthropic: { content: [{ type: 'text', text: 'Ja.' }] },
    gemini: { candidates: [{ content: { parts: [{ text: 'Ja.' }] } }] },
    openai: { choices: [{ message: { content: 'Ja.' } }] },
  };

  it('sends them to Claude as image blocks before the text', async () => {
    const api = fakeApi(() => json(answer.anthropic));
    await createAiClient(
      { kind: 'anthropic', apiKey: KEY, model: 'm' },
      { fetch: api.fetch },
    ).complete(withImage);
    expect((api.calls[0]?.body as { messages: unknown }).messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: PNG } },
          { type: 'text', text: 'Ist der Knopf blau?' },
        ],
      },
    ]);
  });

  it('sends them to Gemini as inline data', async () => {
    const api = fakeApi(() => json(answer.gemini));
    await createAiClient(
      { kind: 'gemini', apiKey: KEY, model: 'm' },
      { fetch: api.fetch },
    ).complete(withImage);
    expect((api.calls[0]?.body as { contents: unknown }).contents).toEqual([
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: PNG } },
          { text: 'Ist der Knopf blau?' },
        ],
      },
    ]);
  });

  it.each(['openai', 'perplexity', 'custom'] as const)(
    'sends them to %s as image_url data addresses',
    async (kind) => {
      const api = fakeApi(() => json(answer.openai));
      await createAiClient(
        { kind, apiKey: KEY, model: 'm', baseUrl: 'http://127.0.0.1:1/v1' },
        { fetch: api.fetch },
      ).complete(withImage);
      expect((api.calls[0]?.body as { messages: unknown }).messages).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Ist der Knopf blau?' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${PNG}` } },
          ],
        },
      ]);
    },
  );
});

describe('Claude (Anthropic Messages API)', () => {
  const config: AiConfig = { kind: 'anthropic', apiKey: KEY, model: 'claude-sonnet-5-5' };

  it('sends system prompt and messages and returns the text', async () => {
    const api = fakeApi(() =>
      json({
        content: [
          { type: 'text', text: 'Klick ' },
          { type: 'text', text: 'auf OK.' },
        ],
      }),
    );
    const text = await createAiClient(config, { fetch: api.fetch }).complete(request);

    expect(text).toBe('Klick auf OK.');
    expect(api.calls[0]).toMatchObject({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: {
        model: 'claude-sonnet-5-5',
        max_tokens: 300,
        system: 'Du testest Websites.',
        messages: request.messages,
      },
    });
  });

  it('lists the models', async () => {
    const api = fakeApi(() =>
      json({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-haiku-5-5' }] }),
    );
    expect(await createAiClient(config, { fetch: api.fetch }).listModels()).toEqual([
      'claude-opus-5-5',
      'claude-haiku-5-5',
    ]);
    expect(api.calls[0]?.url).toBe('https://api.anthropic.com/v1/models?limit=1000');
  });
});

describe('OpenAI (Chat Completions)', () => {
  const config: AiConfig = { kind: 'openai', apiKey: KEY, model: 'gpt-test' };

  it('sends the system prompt as the first message and returns the answer', async () => {
    const api = fakeApi(() => json({ choices: [{ message: { content: 'Fertig.' } }] }));
    expect(await createAiClient(config, { fetch: api.fetch }).complete(request)).toBe('Fertig.');
    expect(api.calls[0]).toMatchObject({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { authorization: `Bearer ${KEY}` },
      body: {
        model: 'gpt-test',
        max_completion_tokens: 300,
        messages: [{ role: 'system', content: 'Du testest Websites.' }, ...request.messages],
      },
    });
  });

  it('lists the models sorted by name', async () => {
    const api = fakeApi(() => json({ data: [{ id: 'gpt-b' }, { id: 'gpt-a' }] }));
    expect(await createAiClient(config, { fetch: api.fetch }).listModels()).toEqual([
      'gpt-a',
      'gpt-b',
    ]);
    expect(api.calls[0]?.url).toBe('https://api.openai.com/v1/models');
  });
});

describe('Perplexity', () => {
  const config: AiConfig = { kind: 'perplexity', apiKey: KEY, model: 'sonar' };

  it('uses the OpenAI-compatible endpoint', async () => {
    const api = fakeApi(() => json({ choices: [{ message: { content: 'Ja.' } }] }));
    expect(await createAiClient(config, { fetch: api.fetch }).complete(request)).toBe('Ja.');
    expect(api.calls[0]).toMatchObject({
      url: 'https://api.perplexity.ai/chat/completions',
      body: { model: 'sonar', max_tokens: 300 },
    });
  });

  it('cannot list its models', async () => {
    const api = fakeApi(() => json({}));
    expect(await createAiClient(config, { fetch: api.fetch }).listModels()).toBeNull();
    expect(api.calls).toHaveLength(0);
  });
});

describe('Gemini (generateContent)', () => {
  const config: AiConfig = { kind: 'gemini', apiKey: KEY, model: 'gemini-test' };

  it('maps the roles and returns the text of the first candidate', async () => {
    const api = fakeApi(() =>
      json({ candidates: [{ content: { parts: [{ text: 'Gut' }, { text: '.' }] } }] }),
    );
    expect(await createAiClient(config, { fetch: api.fetch }).complete(request)).toBe('Gut.');
    expect(api.calls[0]).toMatchObject({
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
      headers: { 'x-goog-api-key': KEY },
      body: {
        systemInstruction: { parts: [{ text: 'Du testest Websites.' }] },
        contents: [
          { role: 'user', parts: [{ text: 'Hallo' }] },
          { role: 'model', parts: [{ text: 'Hi' }] },
          { role: 'user', parts: [{ text: 'Und jetzt?' }] },
        ],
        generationConfig: { maxOutputTokens: 300 },
      },
    });
    // The key goes in a header, never into the address (which may end up in logs).
    expect(api.calls[0]?.url).not.toContain(KEY);
  });

  it('lists only models that can generate text, without the "models/" prefix', async () => {
    const api = fakeApi(() =>
      json({
        models: [
          { name: 'models/gemini-b', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] },
          {
            name: 'models/gemini-a',
            supportedGenerationMethods: ['countTokens', 'generateContent'],
          },
        ],
      }),
    );
    expect(await createAiClient(config, { fetch: api.fetch }).listModels()).toEqual([
      'gemini-a',
      'gemini-b',
    ]);
  });
});

describe('Custom (OpenAI-compatible)', () => {
  it('talks to the entered address, without a key if there is none', async () => {
    const api = fakeApi(() => json({ choices: [{ message: { content: 'lokal' } }] }));
    const client = createAiClient(
      { kind: 'custom', apiKey: null, model: 'llama', baseUrl: 'http://localhost:11434/v1' },
      { fetch: api.fetch },
    );
    expect(await client.complete({ messages: [{ role: 'user', content: 'x' }] })).toBe('lokal');
    expect(api.calls[0]?.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(api.calls[0]?.headers).not.toHaveProperty('authorization');
    expect(api.calls[0]?.body).toEqual({
      model: 'llama',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'x' }],
    });
  });

  it('needs an address', () => {
    expect(() => createAiClient({ kind: 'custom', apiKey: null, model: 'llama' })).toThrow(
      'Für Custom fehlt die Adresse der API.',
    );
  });
});

describe('errors', () => {
  const config: AiConfig = { kind: 'openai', apiKey: KEY, model: 'gpt-test' };
  const fail = async (reply: () => Response | Promise<Response>, timeoutMs?: number) => {
    const api = fakeApi(reply);
    const error = await createAiClient(config, { fetch: api.fetch, timeoutMs })
      .complete(request)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiError);
    return (error as AiError).message;
  };

  it.each([
    [401, 'OpenAI lehnt den API-Schlüssel ab (HTTP 401).'],
    [403, 'OpenAI lehnt den API-Schlüssel ab (HTTP 403).'],
    [429, 'OpenAI: Limit erreicht (HTTP 429). Später erneut versuchen.'],
  ])('explains HTTP %i', async (status, message) => {
    expect(await fail(() => json({ error: { message: 'egal' } }, status))).toBe(message);
  });

  it('passes on what the provider says, without the key', async () => {
    expect(
      await fail(() =>
        json({ error: { message: `The model does not exist for key ${KEY}\nmore` } }, 404),
      ),
    ).toBe('OpenAI antwortet mit HTTP 404: The model does not exist for key ••••');
  });

  it('falls back to the first line of a non-JSON answer', async () => {
    expect(await fail(() => new Response('Bad Gateway\n<html>', { status: 502 }))).toBe(
      'OpenAI antwortet mit HTTP 502: Bad Gateway',
    );
  });

  it('reports an unreachable provider', async () => {
    expect(
      await fail(() => {
        throw new TypeError('fetch failed');
      }),
    ).toBe('OpenAI ist nicht erreichbar: fetch failed');
  });

  it('gives up after the time limit', async () => {
    const never = () =>
      new Promise<Response>(() => {
        /* never answers */
      });
    const api = fakeApi(never);
    // The fake ignores the abort signal, so the client must not rely on fetch rejecting.
    const error = await createAiClient(config, { fetch: api.fetch, timeoutMs: 20 })
      .complete(request)
      .catch((caught: unknown) => caught);
    expect((error as Error).message).toBe('OpenAI antwortet nicht (nach 0,02 s).');
  });

  it('reports an answer that is no JSON', async () => {
    expect(await fail(() => new Response('<html>ok</html>'))).toBe(
      'OpenAI hat keine gültige Antwort geliefert.',
    );
  });

  it('falls back to the text when the error has no message', async () => {
    expect(await fail(() => json({ error: { message: ' ' } }, 500))).toBe(
      'OpenAI antwortet mit HTTP 500: {"error":{"message":" "}}',
    );
  });

  it('reports a failure that is not even an Error', async () => {
    expect(
      await fail(() => {
        throw 'kaputt';
      }),
    ).toBe('OpenAI ist nicht erreichbar: kaputt');
  });

  it('reports an empty answer', async () => {
    expect(await fail(() => json({ choices: [] }))).toBe('OpenAI hat keine Antwort geliefert.');
  });
});

describe('testAiConnection', () => {
  it('checks the key by listing the models and says whether the model is among them', async () => {
    const api = fakeApi(() => json({ data: [{ id: 'gpt-a' }] }));
    const config: AiConfig = { kind: 'openai', apiKey: KEY, model: 'gpt-a' };
    expect(await testAiConnection(config, { fetch: api.fetch })).toEqual({
      models: ['gpt-a'],
      modelKnown: true,
    });
    expect(
      await testAiConnection({ ...config, model: 'gpt-x' }, { fetch: api.fetch }),
    ).toMatchObject({ modelKnown: false });
    expect(await testAiConnection({ ...config, model: '' }, { fetch: api.fetch })).toMatchObject({
      modelKnown: null,
    });
  });

  it('sends a tiny request where models cannot be listed', async () => {
    const api = fakeApi(() => json({ choices: [{ message: { content: 'OK' } }] }));
    const result = await testAiConnection(
      { kind: 'perplexity', apiKey: KEY, model: '' },
      { fetch: api.fetch },
    );
    expect(result).toEqual({ models: null, modelKnown: null });
    // Without a model yet, the first suggestion is used.
    expect(api.calls[0]?.body).toMatchObject({ model: 'sonar', max_tokens: 5 });
  });

  it('fails like a request would', async () => {
    const api = fakeApi(() => json({}, 401));
    await expect(
      testAiConnection({ kind: 'gemini', apiKey: KEY, model: '' }, { fetch: api.fetch }),
    ).rejects.toThrow('Gemini lehnt den API-Schlüssel ab (HTTP 401).');
  });
});

describe('requests without a system prompt', () => {
  const plain = { messages: [{ role: 'user' as const, content: 'Hallo' }] };

  it('leave the system field out for Claude and skip blocks that are no text', async () => {
    const api = fakeApi(() =>
      json({
        content: [
          { type: 'thinking', thinking: '…' },
          { type: 'text', text: 'Ja' },
        ],
      }),
    );
    const client = createAiClient(
      { kind: 'anthropic', apiKey: KEY, model: 'claude-haiku-5-5' },
      { fetch: api.fetch },
    );
    expect(await client.complete(plain)).toBe('Ja');
    expect(api.calls[0]?.body).toEqual({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      messages: plain.messages,
    });
  });

  it('leave the system instruction out for Gemini and accept "models/…" names', async () => {
    const api = fakeApi(() => json({ candidates: [{ content: { parts: [{ text: 'Ja' }] } }] }));
    const client = createAiClient(
      { kind: 'gemini', apiKey: KEY, model: 'models/gemini-test' },
      { fetch: api.fetch },
    );
    expect(await client.complete(plain)).toBe('Ja');
    expect(api.calls[0]?.url).toMatch(/\/models\/gemini-test:generateContent$/);
    expect(api.calls[0]?.body).not.toHaveProperty('systemInstruction');
  });

  it('send OpenAI only the messages', async () => {
    const api = fakeApi(() => json({ choices: [{ message: { content: 'Ja' } }] }));
    const client = createAiClient(
      { kind: 'openai', apiKey: KEY, model: 'm' },
      { fetch: api.fetch },
    );
    await client.complete(plain);
    expect(api.calls[0]?.body).toMatchObject({ messages: plain.messages });
  });
});

describe('odd answers', () => {
  it('treat missing fields as an empty answer', async () => {
    const api = fakeApi(() => json({ candidates: [{}] }));
    const client = createAiClient(
      { kind: 'gemini', apiKey: KEY, model: 'g' },
      { fetch: api.fetch },
    );
    await expect(client.complete({ messages: [] })).rejects.toThrow(
      'Gemini hat keine Antwort geliefert.',
    );
  });

  it('treat an answer that is no object as empty', async () => {
    const api = fakeApi(() => json(['kein', 'objekt']));
    const client = createAiClient(
      { kind: 'openai', apiKey: KEY, model: 'm' },
      { fetch: api.fetch },
    );
    expect(await client.listModels()).toEqual([]);
  });
});

describe('token usage of an answer', () => {
  const ask = { messages: [{ role: 'user' as const, content: 'Hi' }] };
  const reported = async (config: AiConfig, answer: unknown) => {
    const seen: unknown[] = [];
    const api = fakeApi(() => json(answer));
    const client = createAiClient(config, {
      fetch: api.fetch,
      onUsage: (usage) => seen.push(usage),
    });
    await client.complete(ask);
    return seen;
  };

  it('Claude: input without cache reads, cache writes counted as input, cache reads apart', async () => {
    const seen = await reported(
      { kind: 'anthropic', apiKey: KEY, model: 'claude-x' },
      {
        content: [{ type: 'text', text: 'OK' }],
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 400,
          output_tokens: 20,
        },
      },
    );
    expect(seen).toEqual([{ inputTokens: 150, outputTokens: 20, cachedTokens: 400 }]);
  });

  it('OpenAI, Perplexity and Custom: cached tokens are taken out of the prompt tokens', async () => {
    for (const kind of ['openai', 'perplexity', 'custom'] as const) {
      const seen = await reported(
        { kind, apiKey: KEY, model: 'm', baseUrl: 'http://localhost:11434/v1' },
        {
          choices: [{ message: { content: 'OK' } }],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 30,
            prompt_tokens_details: { cached_tokens: 600 },
          },
        },
      );
      expect(seen, kind).toEqual([{ inputTokens: 400, outputTokens: 30, cachedTokens: 600 }]);
    }
  });

  it('Gemini: cached out of the prompt, thinking tokens billed as output', async () => {
    const seen = await reported(
      { kind: 'gemini', apiKey: KEY, model: 'gemini-x' },
      {
        candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        usageMetadata: {
          promptTokenCount: 900,
          cachedContentTokenCount: 300,
          candidatesTokenCount: 40,
          thoughtsTokenCount: 60,
        },
      },
    );
    expect(seen).toEqual([{ inputTokens: 600, outputTokens: 100, cachedTokens: 300 }]);
  });

  it('is reported for every answer, also when its text is empty', async () => {
    const seen: unknown[] = [];
    const api = fakeApi(() =>
      json({
        choices: [{ message: { content: '' } }],
        usage: { prompt_tokens: 5, completion_tokens: 0 },
      }),
    );
    const client = createAiClient(
      { kind: 'openai', apiKey: KEY, model: 'm' },
      { fetch: api.fetch, onUsage: (usage) => seen.push(usage) },
    );
    await expect(client.complete(ask)).rejects.toBeInstanceOf(AiError);
    expect(seen).toEqual([{ inputTokens: 5, outputTokens: 0, cachedTokens: 0 }]);
  });

  it('reports nothing when the answer has no usage, and ignores odd numbers', async () => {
    expect(
      await reported(
        { kind: 'openai', apiKey: KEY, model: 'm' },
        { choices: [{ message: { content: 'OK' } }] },
      ),
    ).toEqual([]);
    expect(usageOf('openai', { usage: { prompt_tokens: -3, completion_tokens: 'x' } })).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
    });
    expect(usageOf('gemini', {})).toBeNull();
    expect(usageOf('anthropic', {})).toBeNull();
  });
});
