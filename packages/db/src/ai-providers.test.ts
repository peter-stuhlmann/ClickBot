import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import {
  deleteAiProvider,
  getAiConfig,
  listAiProviders,
  saveAiProvider,
  setDefaultAiProvider,
} from './ai-providers';
import { createCipher } from './crypto';
import { NotFoundError, ValidationError } from './errors';
import { aiProviders } from './schema';

const cipher = createCipher(randomBytes(32));
const CLAUDE_KEY = 'sk-ant-api-geheim-1234';

const issuesOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
};

describe('saveAiProvider', () => {
  it('stores the key encrypted and shows only its last four characters', async () => {
    await saveAiProvider(db, cipher, {
      kind: 'anthropic',
      model: 'claude-sonnet-5-5',
      apiKey: CLAUDE_KEY,
    });

    const [row] = await db.select().from(aiProviders);
    expect(row?.apiKeyEnc).not.toContain('geheim');
    expect(await listAiProviders(db)).toEqual([
      {
        kind: 'anthropic',
        model: 'claude-sonnet-5-5',
        baseUrl: null,
        keyHint: '…1234',
        isDefault: true,
        updatedAt: expect.any(Date),
      },
    ]);
    // The listing never carries the key, not even encrypted.
    expect(JSON.stringify(await listAiProviders(db))).not.toContain(row?.apiKeyEnc);
  });

  it('keeps the stored key when the field stays empty', async () => {
    await saveAiProvider(db, cipher, { kind: 'anthropic', model: 'a', apiKey: CLAUDE_KEY });
    await saveAiProvider(db, cipher, { kind: 'anthropic', model: 'b', apiKey: '' });

    expect(await getAiConfig(db, cipher)).toEqual({
      kind: 'anthropic',
      model: 'b',
      apiKey: CLAUDE_KEY,
      baseUrl: null,
    });
  });

  it('replaces the key when a new one is entered', async () => {
    await saveAiProvider(db, cipher, { kind: 'openai', model: 'm', apiKey: 'sk-alt-000000000' });
    await saveAiProvider(db, cipher, { kind: 'openai', model: 'm', apiKey: 'sk-neu-999999999' });
    expect((await getAiConfig(db, cipher))?.apiKey).toBe('sk-neu-999999999');
  });

  it('needs a key for a provider that has none yet', async () => {
    expect(await issuesOf(saveAiProvider(db, cipher, { kind: 'gemini', model: 'm' }))).toEqual([
      { path: 'apiKey', message: 'Bitte den API-Schlüssel eintragen.' },
    ]);
  });

  it('reports a missing key together with the other problems', async () => {
    expect(await issuesOf(saveAiProvider(db, cipher, { kind: 'gemini', model: '' }))).toEqual([
      { path: 'model', message: 'Bitte ausfüllen.' },
      { path: 'apiKey', message: 'Bitte den API-Schlüssel eintragen.' },
    ]);
  });

  it('reports form problems with their field', async () => {
    expect(
      await issuesOf(saveAiProvider(db, cipher, { kind: 'custom', model: '', baseUrl: '' })),
    ).toEqual([
      { path: 'model', message: 'Bitte ausfüllen.' },
      {
        path: 'baseUrl',
        message: 'Bitte die Adresse der API angeben, z. B. http://localhost:11434/v1.',
      },
    ]);
  });

  it('accepts a custom endpoint without a key', async () => {
    await saveAiProvider(db, cipher, {
      kind: 'custom',
      model: 'llama',
      baseUrl: 'http://localhost:11434/v1/',
    });
    expect(await getAiConfig(db, cipher, 'custom')).toEqual({
      kind: 'custom',
      model: 'llama',
      apiKey: null,
      baseUrl: 'http://localhost:11434/v1',
    });
  });

  it('makes only the first provider the default', async () => {
    await saveAiProvider(db, cipher, { kind: 'openai', model: 'm', apiKey: 'sk-1-00000000000' });
    await saveAiProvider(db, cipher, { kind: 'gemini', model: 'g', apiKey: 'AIza-0000000000' });
    expect((await listAiProviders(db)).map((p) => [p.kind, p.isDefault])).toEqual([
      ['gemini', false],
      ['openai', true],
    ]);
  });
});

describe('setDefaultAiProvider', () => {
  it('moves the default to another provider', async () => {
    await saveAiProvider(db, cipher, { kind: 'openai', model: 'm', apiKey: 'sk-1-00000000000' });
    await saveAiProvider(db, cipher, { kind: 'gemini', model: 'g', apiKey: 'AIza-0000000000' });
    await setDefaultAiProvider(db, 'gemini');

    expect((await getAiConfig(db, cipher))?.kind).toBe('gemini');
    expect((await listAiProviders(db)).filter((p) => p.isDefault)).toHaveLength(1);
  });

  it('fails for a provider that is not set up', async () => {
    await expect(setDefaultAiProvider(db, 'perplexity')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleteAiProvider', () => {
  it('removes the provider with its key and passes the default on', async () => {
    await saveAiProvider(db, cipher, { kind: 'openai', model: 'm', apiKey: 'sk-1-00000000000' });
    await saveAiProvider(db, cipher, { kind: 'gemini', model: 'g', apiKey: 'AIza-0000000000' });
    await deleteAiProvider(db, 'openai');

    expect(await listAiProviders(db)).toEqual([
      expect.objectContaining({ kind: 'gemini', isDefault: true }),
    ]);
  });

  it('leaves no default when the last one goes', async () => {
    await saveAiProvider(db, cipher, { kind: 'openai', model: 'm', apiKey: 'sk-1-00000000000' });
    await deleteAiProvider(db, 'openai');
    expect(await getAiConfig(db, cipher)).toBeNull();
  });

  it('changes nothing for a provider that is not set up', async () => {
    await expect(deleteAiProvider(db, 'gemini')).resolves.toBeUndefined();
  });
});

describe('getAiConfig', () => {
  it('is null while no provider is set up', async () => {
    expect(await getAiConfig(db, cipher)).toBeNull();
    expect(await getAiConfig(db, cipher, 'openai')).toBeNull();
  });
});
