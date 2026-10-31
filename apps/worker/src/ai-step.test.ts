import type { AgentAction, AgentInput } from '@click-bot/ai';
import { flowSchema, type Flow } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { MAX_AI_ACTIONS } from './ai-step';
import { runFlow, type RunOptions } from './run-flow';

const browser = useBrowser();

const flow = (steps: unknown[]): Flow => flowSchema.parse({ version: 1, steps });
const role = (r: string, name: string) => ({ by: 'role', role: r, name });
const aiStep = (instruction: string) => ({ id: 'ki', type: 'ai', instruction });
const open = { id: 'open', type: 'open', url: '/kontakt.html' };

/** Stands in for the AI: answers with the next of `actions` and records what it was shown. */
function script(...actions: Record<string, unknown>[]) {
  const seen: AgentInput[] = [];
  const drive = async (input: AgentInput): Promise<AgentAction> => {
    seen.push(structuredClone(input));
    const next = actions.shift();
    if (!next) throw new Error('No action left.');
    if (next.type === 'done') return { kind: 'done', summary: String(next.summary) };
    if (next.type === 'fail') return { kind: 'fail', reason: String(next.reason) };
    return {
      kind: 'step',
      step: flowSchema.parse({ version: 1, steps: [{ ...next, id: 'ki' }] }).steps[0] as never,
    };
  };
  return { drive, seen };
}

async function run(steps: unknown[], options: Partial<RunOptions> = {}) {
  const context = await browser.newContext();
  try {
    return await runFlow(context, flow(steps), {
      baseUrl: browser.origin(),
      runNr: 3,
      botNr: 1,
      secrets: {},
      ...options,
    });
  } finally {
    await context.close();
  }
}

describe('AI steps', () => {
  it('lets the AI find its way through the page, action by action, until it is done', async () => {
    const { drive, seen } = script(
      { type: 'click', target: role('button', 'Alle akzeptieren') },
      { type: 'fill', target: { by: 'label', label: 'Name' }, value: '{{faker.name}}' },
      { type: 'select', target: { by: 'label', label: 'Anliegen' }, option: 'Support' },
      { type: 'click', target: role('button', 'Absenden') },
      { type: 'done', summary: 'Das Formular ist abgeschickt.' },
    );
    const result = await run([open, aiStep('Schick das Kontaktformular ab.')], { ai: drive });

    expect(result.status).toBe('passed');
    expect(result.steps[1]?.aiActions).toEqual([
      'Klick auf Rolle „button“ mit Name „Alle akzeptieren“: ok',
      'Feld „Name“ ausgefüllt mit „{{faker.name}}“: ok',
      'Feld „Anliegen“ auf „Support“ gesetzt: ok',
      'Klick auf Rolle „button“ mit Name „Absenden“: ok',
      'Fertig: Das Formular ist abgeschickt.',
    ]);
    // Each answer comes after a fresh look at the page; the last one sees the thank-you page.
    expect(seen[0]).toMatchObject({
      instruction: 'Schick das Kontaktformular ab.',
      startUrl: browser.origin(),
      history: [],
    });
    expect(seen[0]?.page.snapshot).toContain('button "Alle akzeptieren"');
    expect(seen[4]?.page.url).toContain('/danke');
    expect(seen[4]?.history).toHaveLength(4);
  });

  it('tells the AI what went wrong, so it can try another way', async () => {
    const { drive, seen } = script(
      { type: 'click', target: role('button', 'Senden'), timeoutMs: 500 },
      { type: 'done', summary: 'Aufgegeben.' },
    );
    const result = await run([open, aiStep('Klick auf Senden.')], { ai: drive });
    expect(result.status).toBe('passed');
    expect(seen[1]?.history[0]?.result).toMatch(
      /^Element nicht gefunden: Rolle „button“ mit Name „Senden“/,
    );
    expect(result.steps[1]?.aiActions?.[0]).toMatch(/^Klick auf .*„Senden“: Element nicht/);
  });

  it('fails with the reason of the AI, and keeps what it did for the report', async () => {
    const { drive } = script(
      { type: 'click', target: role('button', 'Alle akzeptieren') },
      { type: 'fail', reason: 'Die Seite zeigt ein Captcha.' },
    );
    const again = { ...open, id: 'open-2' };
    const result = await run([open, aiStep('Melde dich an.'), again], { ai: drive });
    expect(result.status).toBe('failed');
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: 'KI: Die Seite zeigt ein Captcha.',
      aiActions: [
        'Klick auf Rolle „button“ mit Name „Alle akzeptieren“: ok',
        'Abgebrochen: Die Seite zeigt ein Captcha.',
      ],
    });
    expect(result.steps[2]?.status).toBe('skipped');
  });

  it('opens only pages of the website under test', async () => {
    const { drive, seen } = script(
      { type: 'open', url: 'https://example.org/' },
      { type: 'open', url: '/danke.html' },
      { type: 'done', summary: 'Ok.' },
    );
    const result = await run([open, aiStep('Geh weiter.')], { ai: drive });
    expect(seen[1]?.history[0]?.result).toBe('nicht erlaubt: nur Seiten der getesteten Website');
    expect(seen[2]?.history[1]?.result).toBe('ok');
    expect(result.status).toBe('passed');
  });

  it('never shows the AI the value of a secret', async () => {
    const { drive, seen } = script(
      { type: 'click', target: role('button', 'Alle akzeptieren') },
      { type: 'fill', target: { by: 'label', label: 'Name' }, value: '{{secret.kunde}}' },
      { type: 'click', target: role('button', 'Absenden') },
      { type: 'done', summary: 'Ok.' },
    );
    const result = await run([open, aiStep('Trag den Kunden ein.')], {
      ai: drive,
      secrets: { kunde: 'Geheim-4711' },
    });
    expect(result.status).toBe('passed');
    expect(seen[0]?.secretNames).toEqual(['kunde']);
    expect(JSON.stringify(seen)).not.toContain('Geheim-4711');
    // The thank-you page greets with the name, which is the secret here.
    expect(seen[3]?.page.snapshot).toMatch(/Hallo •+/);
    expect(seen[3]?.page.url).toMatch(/name=•+$/);
  });

  it(`stops after ${MAX_AI_ACTIONS} actions`, async () => {
    const { drive } = script(
      ...Array.from({ length: MAX_AI_ACTIONS }, () => ({
        type: 'scroll',
        to: { kind: 'by', direction: 'down', distance: 10 },
      })),
    );
    const result = await run([open, aiStep('Scroll für immer.')], { ai: drive });
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: `KI-Schritt nicht fertig nach ${MAX_AI_ACTIONS} Aktionen.`,
    });
    expect(result.steps[1]?.aiActions).toHaveLength(MAX_AI_ACTIONS);
  });

  it('says what is missing when no AI provider is set up', async () => {
    const result = await run([open, aiStep('Schick das Formular ab.')]);
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: 'Kein KI-Anbieter eingerichtet: unter „Einstellungen → KI & API“ einen speichern.',
    });
  });

  it('reports a problem with the AI provider in the step', async () => {
    const drive = async (): Promise<AgentAction> => {
      throw new Error('Der KI-Anbieter antwortet nicht (nach 60 s).');
    };
    const result = await run([open, aiStep('Los.')], { ai: drive });
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: 'KI-Anbieter: Der KI-Anbieter antwortet nicht (nach 60 s).',
      aiActions: [],
    });
  });
});
