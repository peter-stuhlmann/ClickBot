import {
  getBrowserLimit,
  createCipher,
  createJob,
  createSecret,
  getRunUsage,
  getWorkerStatus,
  queueTestRun,
  saveAiProvider,
  schema,
  type Cipher,
} from '@click-bot/db';
import { eq } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { guardContext, useBrowser } from '../test/browser';
import { db, resetDb, testConnection } from '../test/db';
import { createFileArtifactStore } from './artifacts';
import { createBrowserManager } from './browser-manager';
import { createWorker, type Worker, type WorkerDeps } from './worker';

const browser = useBrowser();
const cipher = createCipher(randomBytes(32));
let artifactsDir: string;
let worker: Worker | undefined;

beforeEach(async () => {
  await resetDb();
  artifactsDir = await mkdtemp(join(tmpdir(), 'click-bot-artifacts-'));
});

afterEach(async () => {
  await worker?.stop();
  worker = undefined;
  await rm(artifactsDir, { recursive: true, force: true });
});

afterAll(async () => {
  await testConnection.close();
});

function startWorker(
  options: {
    maxConcurrent?: number;
    cipher?: Cipher;
    newContext?: WorkerDeps['newContext'];
    createAiClient?: WorkerDeps['createAiClient'];
    artifacts?: WorkerDeps['artifacts'];
  } = {},
): Worker {
  worker = createWorker({
    createAiClient: options.createAiClient,
    db,
    cipher: options.cipher ?? cipher,
    newContext: options.newContext ?? (() => browser.newContext()),
    artifacts: options.artifacts ?? createFileArtifactStore(artifactsDir),
    maxConcurrent: options.maxConcurrent ?? 6,
    workerId: 'test-worker',
  });
  return worker;
}

const contactSteps = [
  { id: 'open', type: 'open', url: '/kontakt.html' },
  { id: 'name', type: 'fill', target: { by: 'label', label: 'Name' }, value: 'Browser {{bot_nr}}' },
  { id: 'send', type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
  { id: 'thanks', type: 'assert', assertion: { kind: 'textVisible', text: 'Vielen Dank' } },
];

/** An active job whose wave of `bots` starts right now. */
async function dueJob(steps: unknown[], bots = 1) {
  const [customer] = await db
    .insert(schema.customers)
    .values({ name: 'Beispiel GmbH', slug: 'beispiel' })
    .returning();
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({ customerId: customer?.id as string, name: 'Allgemein' })
    .returning();
  const job = await createJob(db, {
    campaignId: campaign?.id as string,
    name: 'Kontaktformular-Test',
    startUrl: `${browser.origin()}/kontakt.html`,
    flow: { version: 1, steps },
    schedule: {
      type: 'interval',
      everyMinutes: 60,
      maxRuns: bots,
      startAt: new Date(Date.now() - 1_000).toISOString(),
    },
  });
  // For several bots at once use a single slot instead of an interval.
  if (bots > 1) {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
    const time = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
    await db
      .update(schema.jobs)
      .set({
        schedule: {
          type: 'times',
          slots: [{ date, time, bots }],
          staggerSeconds: 0,
          timezone: 'Europe/Berlin',
        },
      })
      .where(eq(schema.jobs.id, job.id));
  }
  await db.update(schema.jobs).set({ status: 'active' }).where(eq(schema.jobs.id, job.id));
  return { job, customerId: customer?.id as string };
}

const allRuns = () => db.select().from(schema.runs).orderBy(schema.runs.runNr);

describe('worker', () => {
  it('runs an AI step with the default provider and stores what the AI did', async () => {
    await saveAiProvider(db, cipher, {
      kind: 'custom',
      model: 'test-modell',
      baseUrl: 'http://127.0.0.1:1/v1',
    });
    const configs: string[] = [];
    const replies = [
      '{"type":"click","target":{"by":"role","role":"button","name":"Alle akzeptieren"}}',
      JSON.stringify({
        type: 'verdict',
        summary: 'Die Cookies lassen sich akzeptieren.',
        criteria: [{ goal: 'Cookies lassen sich akzeptieren.', status: 'met', evidence: 'Weg.' }],
      }),
    ];
    await dueJob([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      { id: 'ki', type: 'ai', instruction: 'Akzeptiere die Cookies.' },
    ]);
    const w = startWorker({
      createAiClient: (config) => {
        configs.push(`${config.kind}/${config.model}`);
        return {
          complete: async () => replies.shift() ?? '',
          listModels: async () => null,
        };
      },
    });

    await w.tick();
    await w.idle();
    const [run] = await allRuns();
    expect(run?.status).toBe('passed');
    expect(configs).toEqual(['custom/test-modell']);
    const steps = await db.select().from(schema.runSteps).orderBy(schema.runSteps.stepIndex);
    expect(steps[1]).toMatchObject({
      status: 'passed',
      aiActions: ['Klick auf Rolle „button“ mit Name „Alle akzeptieren“: ok'],
      aiVerdict: [{ goal: 'Cookies lassen sich akzeptieren.', status: 'met', evidence: 'Weg.' }],
      aiSummary: 'Die Cookies lassen sich akzeptieren.',
    });
  });

  it('runs an AI step through tool calls when the provider has them, and stores the result', async () => {
    await saveAiProvider(db, cipher, {
      kind: 'custom',
      model: 'test-modell',
      baseUrl: 'http://127.0.0.1:1/v1',
    });
    const calls = [
      { name: 'click', args: { target: { by: 'role', role: 'button', name: 'Alle akzeptieren' } } },
      {
        name: 'verdict',
        args: {
          summary: 'Der Cookie-Banner lässt sich schließen.',
          criteria: [{ goal: 'Cookies lassen sich akzeptieren.', status: 'met', evidence: 'Weg.' }],
        },
      },
    ];
    const offered: string[][] = [];
    await dueJob([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      { id: 'ki', type: 'ai', instruction: 'Akzeptiere die Cookies.' },
    ]);
    const w = startWorker({
      createAiClient: () => ({
        supportsTools: true,
        completeWithTools: async (_request, tools) => {
          offered.push(tools.map((tool) => tool.name));
          return { call: calls.shift() ?? null, text: '' };
        },
        complete: async () => {
          throw new Error('The text path must not be used.');
        },
        listModels: async () => null,
      }),
    });
    await w.tick();
    await w.idle();
    const [run] = await allRuns();
    expect(run?.status).toBe('passed');
    expect(offered[0]).toContain('query');
    const steps = await db.select().from(schema.runSteps).orderBy(schema.runSteps.stepIndex);
    expect(steps[1]).toMatchObject({
      status: 'passed',
      aiSummary: 'Der Cookie-Banner lässt sich schließen.',
    });
  });

  it('stores the tokens the AI used, with its model, and none for a flow without AI', async () => {
    await saveAiProvider(db, cipher, {
      kind: 'custom',
      model: 'test-modell',
      baseUrl: 'http://127.0.0.1:1/v1',
    });
    const answers = [
      '{"type":"click","target":{"by":"role","role":"button","name":"Alle akzeptieren"}}',
      JSON.stringify({
        type: 'verdict',
        summary: 'Die Cookies lassen sich akzeptieren.',
        criteria: [{ goal: 'Cookies lassen sich akzeptieren.', status: 'met', evidence: 'Weg.' }],
      }),
    ];
    await dueJob([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      { id: 'ki', type: 'ai', instruction: 'Akzeptiere die Cookies.' },
    ]);
    const w = startWorker({
      createAiClient: (_config, deps) => ({
        complete: async () => {
          // Each answer reports its tokens, as a provider does.
          deps?.onUsage?.({ inputTokens: 1000, outputTokens: 50, cachedTokens: 400 });
          return answers.shift() ?? '';
        },
        listModels: async () => null,
      }),
    });
    await w.tick();
    await w.idle();
    const [run] = await allRuns();
    expect(await getRunUsage(db, run?.id as string)).toEqual({
      provider: 'custom',
      model: 'test-modell',
      // Two answers: the action and the verdict.
      usage: { inputTokens: 2000, outputTokens: 100, cachedTokens: 800 },
    });
  });

  it('stores no tokens for a run that used no AI', async () => {
    await dueJob([{ id: 'open', type: 'open', url: '/kontakt.html' }]);
    const w = startWorker();
    await w.tick();
    await w.idle();
    const [run] = await allRuns();
    expect(await getRunUsage(db, run?.id as string)).toBeNull();
  });

  it('fails an AI step clearly while no AI provider is set up', async () => {
    await dueJob([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      { id: 'ki', type: 'ai', instruction: 'Akzeptiere die Cookies.' },
    ]);
    const w = startWorker();
    await w.tick();
    await w.idle();
    const [run] = await allRuns();
    expect(run).toMatchObject({
      status: 'failed',
      error: 'Kein KI-Anbieter eingerichtet: unter „Einstellungen → KI & API“ einen speichern.',
    });
  });

  it('opens every run with its own device and browser', async () => {
    const { job } = await dueJob(contactSteps);
    await db
      .update(schema.jobs)
      .set({ devices: ['desktop', 'iphone'], deviceBrowsers: { desktop: ['firefox'] } })
      .where(eq(schema.jobs.id, job.id));
    const opened: string[] = [];
    const w = startWorker({
      newContext: (device, kind) => {
        opened.push(`${device}-${kind}`);
        return browser.newContext();
      },
    });

    await w.tick();
    await w.idle();
    expect(opened.sort()).toEqual(['desktop-firefox', 'iphone-webkit']);
    expect((await allRuns()).map((run) => run.status)).toEqual(['passed', 'passed']);
  });

  it('executes a due run and stores the verdict with every step', async () => {
    await dueJob(contactSteps);
    const w = startWorker();

    expect(await w.tick()).toHaveLength(1);
    await w.idle();

    const [run] = await allRuns();
    expect(run).toMatchObject({ status: 'passed', error: null });
    expect(run?.finishedAt).not.toBeNull();
    const steps = await db.select().from(schema.runSteps).orderBy(schema.runSteps.stepIndex);
    expect(steps.map((s) => [s.stepId, s.status])).toEqual([
      ['open', 'passed'],
      ['name', 'passed'],
      ['send', 'passed'],
      ['thanks', 'passed'],
    ]);
  });

  it('stores a failed run with the reason and a screenshot of the failure', async () => {
    await dueJob([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      {
        id: 'missing',
        type: 'click',
        target: { by: 'role', role: 'button', name: 'Gibt es nicht' },
        timeoutMs: 300,
      },
    ]);
    const w = startWorker();
    await w.tick();
    await w.idle();

    const [run] = await allRuns();
    expect(run?.status).toBe('failed');
    expect(run?.error).toBe(
      'Element nicht gefunden: Rolle „button“ mit Name „Gibt es nicht“ (nach 0,3 s).',
    );
    const steps = await db.select().from(schema.runSteps).orderBy(schema.runSteps.stepIndex);
    const screenshot = steps[1]?.screenshotPath as string;
    expect(screenshot).toMatch(/^runs\/.+\/1-missing\.png$/);
    expect(existsSync(join(artifactsDir, screenshot))).toBe(true);
  });

  it('never runs more browsers at once than allowed', async () => {
    await dueJob(contactSteps, 4);
    const w = startWorker({ maxConcurrent: 2 });

    expect(await w.tick()).toHaveLength(2);
    expect(w.activeRuns()).toBe(2);
    expect(await w.tick()).toHaveLength(0);

    await w.idle();
    expect(await w.tick()).toHaveLength(2);
    await w.idle();

    expect((await allRuns()).map((r) => r.status)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
    ]);
  });

  it('gives each bot of a wave its own number', async () => {
    await dueJob(
      [
        ...contactSteps,
        {
          id: 'hi',
          type: 'assert',
          assertion: { kind: 'textVisible', text: 'Hallo Browser {{bot_nr}}' },
        },
      ],
      3,
    );
    const w = startWorker();
    await w.tick();
    await w.idle();
    expect((await allRuns()).map((r) => r.status)).toEqual(['passed', 'passed', 'passed']);
  });

  it('uses the secrets of the customer and keeps them out of the stored messages', async () => {
    const { customerId } = await dueJob([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      {
        id: 'check',
        type: 'assert',
        assertion: { kind: 'textVisible', text: 'Passwort {{secret.pw}}' },
        timeoutMs: 300,
      },
    ]);
    await createSecret(db, cipher, {
      customerId,
      name: 'pw',
      value: 'Geheim-123',
      allowedDomains: ['127.0.0.1'],
    });
    const w = startWorker();
    await w.tick();
    await w.idle();

    const [run] = await allRuns();
    expect(run?.error).toBe('Text „Passwort ••••“ ist nicht sichtbar (nach 0,3 s).');
    const steps = await db.select().from(schema.runSteps);
    expect(JSON.stringify(steps)).not.toContain('Geheim-123');
  });

  it('records a test run as a video, with when each step ran', async () => {
    const { job } = await dueJob(contactSteps);
    await db.update(schema.jobs).set({ status: 'paused' }).where(eq(schema.jobs.id, job.id));
    await queueTestRun(db, job.id, new Date(), { once: true });
    const w = startWorker();
    await w.tick();
    await w.idle();

    const [run] = await allRuns();
    expect(run?.status).toBe('passed');
    expect(run?.videoPath).toBe(`runs/${run?.id}/video.mp4`);
    expect(existsSync(join(artifactsDir, run?.videoPath ?? ''))).toBe(true);
    expect(run?.videoCues?.filter((cue) => cue.step !== null).map((cue) => cue.step)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('records a scheduled run only when its job asks for it', async () => {
    const { job } = await dueJob(contactSteps);
    const w = startWorker();
    await w.tick();
    await w.idle();
    expect((await allRuns())[0]?.videoPath).toBeNull();

    await db.update(schema.jobs).set({ recordVideo: true }).where(eq(schema.jobs.id, job.id));
    await queueTestRun(db, job.id, new Date(), { once: true });
    await w.tick();
    await w.idle();
    expect((await allRuns()).at(-1)?.videoPath).toMatch(/video\.mp4$/);
  });

  it('keeps the verdict of a run whose video fails, and says why in the log', async () => {
    const { job } = await dueJob(contactSteps);
    await queueTestRun(db, job.id, new Date(), { once: true });
    const store = createFileArtifactStore(artifactsDir);
    const logged: string[] = [];
    worker = createWorker({
      db,
      cipher,
      newContext: () => browser.newContext(),
      artifacts: { ...store, saveVideo: async () => Promise.reject(new Error('Platte voll')) },
      maxConcurrent: 6,
      workerId: 'test-worker',
      log: (message) => logged.push(message),
    });
    await worker.tick();
    await worker.idle();
    const runs = await allRuns();
    expect(runs.map((run) => [run.status, run.videoPath])).toEqual([
      ['passed', null],
      ['passed', null],
    ]);
    expect(logged.some((line) => line.includes('Platte voll'))).toBe(true);
  });

  it('fails the run cleanly if it cannot even start, e.g. with a wrong secrets key', async () => {
    const { customerId } = await dueJob(contactSteps);
    await createSecret(db, cipher, {
      customerId,
      name: 'pw',
      value: 'x',
      allowedDomains: ['127.0.0.1'],
    });
    const w = startWorker({ cipher: createCipher(randomBytes(32)) });
    await w.tick();
    await w.idle();

    const [run] = await allRuns();
    expect(run?.status).toBe('failed');
    expect(run?.error).toMatch(/^Durchlauf konnte nicht ausgeführt werden: /);
  });

  it('finishes running runs on stop and starts no new ones', async () => {
    await dueJob(contactSteps, 2);
    const w = startWorker({ maxConcurrent: 1 });
    await w.tick();

    await w.stop();

    expect(w.activeRuns()).toBe(0);
    expect(await w.tick()).toEqual([]);
    expect((await allRuns()).map((r) => r.status)).toEqual(['passed', 'queued']);
  });

  it('reports itself as online through its heartbeat, with its browser limit', async () => {
    const w = startWorker({ maxConcurrent: 3 });
    await w.heartbeat();
    expect((await getWorkerStatus(db, new Date())).online).toBe(true);
    expect(await getBrowserLimit(db)).toBe(3);
  });

  it('gets a new browser after a crash, so the next run works again', async () => {
    await dueJob(contactSteps, 2);
    const browsers = createBrowserManager(() => chromium.launch());
    try {
      const w = createWorker({
        db,
        cipher,
        newContext: async () =>
          guardContext(await (await browsers.get()).newContext(), browser.origin()),
        artifacts: createFileArtifactStore(artifactsDir),
        maxConcurrent: 1,
        workerId: 'test-worker',
      });
      worker = w;
      await w.tick();
      await w.idle();

      // From the outside, like a crash of Chromium between two runs.
      await (await browsers.get()).close();
      await w.tick();
      await w.idle();

      expect((await allRuns()).map((r) => r.status)).toEqual(['passed', 'passed']);
    } finally {
      await worker?.stop();
      worker = undefined;
      await browsers.close();
    }
  });
});
