import { describe, expect, it } from 'vitest';
import { AiError, createAiClient, testAiConnection, type AiConfig } from './client';

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
