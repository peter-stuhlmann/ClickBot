import { describe, expect, it } from 'vitest';
import { db, insertCampaign, insertCustomer } from '../test/db';
import {
  deleteModelPrice,
  getRunUsage,
  listJobUsage,
  listKnownModels,
  listModelPrices,
  listRunsUsage,
  saveModelPrice,
} from './ai-usage';
import { ValidationError } from './errors';
import { createJob } from './jobs';
import { completeRun } from './queue';
import { aiProviders, runs } from './schema';

const flow = { version: 1, steps: [{ id: 'open', type: 'open', url: 'https://beispiel.de' }] };
const at = new Date('2026-11-05T12:30:00Z');

let jobNr = 0;
async function job() {
  jobNr += 1;
  const customer = await insertCustomer(`Kunde ${jobNr}`, `kunde-${jobNr}`);
  const { campaignId } = await insertCampaign('Allgemein', customer);
  return createJob(db, {
    campaignId,
    name: `Test ${jobNr}`,
    startUrl: 'https://beispiel.de',
    flow,
    schedule: { type: 'interval', everyMinutes: 15, maxRuns: 20, startAt: '2026-11-05T10:00:00Z' },
  });
}

let runNr = 0;
async function runningRun(jobId: string) {
  runNr += 1;
  const [row] = await db
    .insert(runs)
    .values({ jobId, runNr, device: 'desktop', status: 'running', scheduledAt: at, startedAt: at })
    .returning({ id: runs.id });
  return (row as { id: string }).id;
}

const outcome = { status: 'passed' as const, finishedAt: at, steps: [] };

describe('saveModelPrice', () => {
  const price = {
    provider: 'anthropic',
    model: 'claude-x',
    inputPerMillion: 3,
    outputPerMillion: 15,
    cachedPerMillion: 0.3,
  };

  it('stores a price and replaces it for the same provider and model', async () => {
    await saveModelPrice(db, price);
    await saveModelPrice(db, { ...price, inputPerMillion: 4, cachedPerMillion: null });
    await saveModelPrice(db, { ...price, provider: 'openai' });
    const rows = await listModelPrices(db);
    expect(rows.map((r) => [r.provider, r.model, r.inputPerMillion, r.cachedPerMillion])).toEqual([
      // In the order of the providers in the settings, not alphabetical.
      ['openai', 'claude-x', 3, 0.3],
      ['anthropic', 'claude-x', 4, null],
    ]);
  });

  it('reports every wrong field at once', async () => {
    const error = await saveModelPrice(db, {
      provider: 'nope',
      model: '  ',
      inputPerMillion: -1,
      outputPerMillion: Number.NaN,
      cachedPerMillion: 1e9,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues.map((i) => i.path).sort()).toEqual([
      'cachedPerMillion',
      'inputPerMillion',
      'model',
      'outputPerMillion',
      'provider',
    ]);
    expect(await listModelPrices(db)).toEqual([]);
  });

  it('removes a price', async () => {
    await saveModelPrice(db, price);
    await deleteModelPrice(db, 'anthropic', 'claude-x');
    expect(await listModelPrices(db)).toEqual([]);
  });
});

describe('the tokens of a run', () => {
  it('are stored with the verdict of the run and read back', async () => {
    const { id: jobId } = await job();
    const runId = await runningRun(jobId);
    await completeRun(db, runId, {
      ...outcome,
      aiUsage: {
        provider: 'gemini',
        model: 'gemini-x',
        usage: { inputTokens: 1000, outputTokens: 200, cachedTokens: 300 },
      },
    });
    expect(await getRunUsage(db, runId)).toEqual({
      provider: 'gemini',
      model: 'gemini-x',
      usage: { inputTokens: 1000, outputTokens: 200, cachedTokens: 300 },
    });
  });

  it('are left out for a run without AI, or one that used no tokens', async () => {
    const { id: jobId } = await job();
    const plain = await runningRun(jobId);
    await completeRun(db, plain, outcome);
    const empty = await runningRun(jobId);
    await completeRun(db, empty, {
      ...outcome,
      aiUsage: {
        provider: 'openai',
        model: 'm',
        usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
      },
    });
    expect(await getRunUsage(db, plain)).toBeNull();
    expect(await getRunUsage(db, empty)).toBeNull();
  });

  it('are added up per job and model over all its runs, apart from other jobs', async () => {
    const a = await job();
    const b = await job();
    const usage = (n: number) => ({ inputTokens: n, outputTokens: n * 2, cachedTokens: n * 3 });
    for (const [jobId, model, n] of [
      [a.id, 'm1', 1],
      [a.id, 'm1', 10],
      [a.id, 'm2', 100],
      [b.id, 'm1', 1000],
    ] as const) {
      await completeRun(db, await runningRun(jobId), {
        ...outcome,
        aiUsage: { provider: 'openai', model, usage: usage(n) },
      });
    }
    await completeRun(db, await runningRun(a.id), outcome); // no AI

    const sums = await listJobUsage(db, [a.id, b.id]);
    expect(sums.get(a.id)).toEqual([
      { provider: 'openai', model: 'm1', usage: usage(11) },
      { provider: 'openai', model: 'm2', usage: usage(100) },
    ]);
    expect(sums.get(b.id)).toEqual([{ provider: 'openai', model: 'm1', usage: usage(1000) }]);
    expect((await listJobUsage(db, [])).size).toBe(0);
  });

  it('are listed for several runs at once, with no entry for a run without AI', async () => {
    const { id: jobId } = await job();
    const usage = { inputTokens: 5, outputTokens: 6, cachedTokens: 7 };
    const withAi = await runningRun(jobId);
    await completeRun(db, withAi, {
      ...outcome,
      aiUsage: { provider: 'openai', model: 'm', usage },
    });
    const plain = await runningRun(jobId);
    await completeRun(db, plain, outcome);

    const found = await listRunsUsage(db, [withAi, plain]);
    expect([...found.keys()]).toEqual([withAi]);
    expect(found.get(withAi)).toEqual({ provider: 'openai', model: 'm', usage });
    expect((await listRunsUsage(db, [])).size).toBe(0);
  });

  it('go with the run when it is deleted', async () => {
    const { id: jobId } = await job();
    const runId = await runningRun(jobId);
    await completeRun(db, runId, {
      ...outcome,
      aiUsage: {
        provider: 'openai',
        model: 'm',
        usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
      },
    });
    await db.delete(runs);
    expect(await getRunUsage(db, runId)).toBeNull();
  });
});

describe('listKnownModels', () => {
  it('lists the models of the providers and of the runs, each once', async () => {
    await db.insert(aiProviders).values({
      kind: 'openai',
      model: 'gpt-x',
      apiKeyEnc: 'x',
      apiKeyHint: '…1234',
      isDefault: true,
    });
    const { id: jobId } = await job();
    for (const [provider, model] of [
      ['openai', 'gpt-x'],
      ['openai', 'gpt-old'],
      ['gemini', 'gemini-x'],
    ] as const) {
      await completeRun(db, await runningRun(jobId), {
        ...outcome,
        aiUsage: { provider, model, usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 } },
      });
    }
    expect(await listKnownModels(db)).toEqual([
      { provider: 'gemini', model: 'gemini-x' },
      { provider: 'openai', model: 'gpt-old' },
      { provider: 'openai', model: 'gpt-x' },
    ]);
  });
});
