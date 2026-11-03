import type { AgentAction, AgentInput } from '@click-bot/ai';
import { flowSchema, type Criterion, type Flow } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { MAX_AI_ACTIONS } from './ai-step';
import { runFlow, type RunOptions } from './run-flow';

const browser = useBrowser();

const flow = (steps: unknown[]): Flow => flowSchema.parse({ version: 1, steps });
const role = (r: string, name: string) => ({ by: 'role', role: r, name });
const goalStep = (instruction: string) => ({ id: 'ziel', type: 'ai', instruction });
const open = { id: 'open', type: 'open', url: '/kontakt.html' };

const met = (goal: string): Criterion => ({ goal, status: 'met', evidence: 'Gesehen.' });
const SUMMARY = 'Alles wie erwartet.';
const verdict = (...criteria: Criterion[]) => ({ type: 'verdict', summary: SUMMARY, criteria });

/** Stands in for the AI: answers with the next of `answers` and records what it was shown. */
function script(...answers: Record<string, unknown>[]) {
  const seen: AgentInput[] = [];
  const drive = async (input: AgentInput): Promise<AgentAction> => {
    seen.push(structuredClone(input));
    const next = answers.shift();
    if (!next) throw new Error('No answer left.');
    if (next.type === 'verdict') {
      return {
        kind: 'verdict',
        criteria: next.criteria as Criterion[],
        summary: next.summary as string,
      };
    }
    if (next.type === 'inspect') return { kind: 'inspect', target: next.target as never };
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

describe('AI steps (free tests)', () => {
  it('finds its own way, then judges every sub-goal; all met passes', async () => {
    const { drive, seen } = script(
      { type: 'click', target: role('button', 'Alle akzeptieren') },
      { type: 'fill', target: { by: 'label', label: 'Name' }, value: '{{faker.name}}' },
      { type: 'click', target: role('button', 'Absenden') },
      verdict(met('Es gibt ein Kontaktformular.'), met('Nach dem Absenden kommt ein Dank.')),
    );
    const result = await run([open, goalStep('Das Kontaktformular lässt sich abschicken.')], {
      ai: drive,
    });

    expect(result.status).toBe('passed');
    expect(result.steps[1]).toMatchObject({
      status: 'passed',
      aiActions: [
        'Klick auf Rolle „button“ mit Name „Alle akzeptieren“: ok',
        'Feld „Name“ ausgefüllt mit „{{faker.name}}“: ok',
        'Klick auf Rolle „button“ mit Name „Absenden“: ok',
      ],
      aiVerdict: [met('Es gibt ein Kontaktformular.'), met('Nach dem Absenden kommt ein Dank.')],
    });
    expect(result.steps[1]?.message).toBeUndefined();
    // Every round comes with a fresh look: structure and screenshot.
    expect(seen[0]).toMatchObject({ instruction: 'Das Kontaktformular lässt sich abschicken.' });
    expect(seen[0]?.page.snapshot).toContain('button "Alle akzeptieren"');
    expect(seen[0]?.page.screenshot?.mediaType).toBe('image/jpeg');
    expect(Buffer.from(seen[0]?.page.screenshot?.data ?? '', 'base64').subarray(0, 2)).toEqual(
      Buffer.from([0xff, 0xd8]),
    );
    expect(seen[3]?.page.url).toContain('/danke');
    // The page as judged goes into the report.
    expect(result.screenshots.map((shot) => shot.stepId)).toEqual(['ziel']);
  });

  it('fails when a sub-goal is not met, and says which', async () => {
    const { drive } = script(
      verdict(met('Es gibt ein Formular.'), {
        goal: 'Der Button ist blau.',
        status: 'failed',
        evidence: 'Er ist grau.',
      }),
    );
    const again = { ...open, id: 'open-2' };
    const result = await run([open, goalStep('Ein blauer Button.'), again], { ai: drive });
    // The flow worked, the expectation of the test is not met: "Nicht bestanden".
    expect(result.status).toBe('not_passed');
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: 'Nicht erfüllt: Der Button ist blau. Er ist grau.',
    });
    expect(result.steps[2]?.status).toBe('skipped');
  });

  it('goes on with a warning when a sub-goal could not be checked', async () => {
    const { drive } = script(
      verdict(met('Es gibt ein Formular.'), {
        goal: 'Die Nachricht kommt an.',
        status: 'unknown',
        evidence: 'Die Seite zeigt ein Captcha.',
      }),
    );
    const again = { ...open, id: 'open-2' };
    const result = await run([open, goalStep('Formular kommt an.'), again], { ai: drive });
    expect(result.status).toBe('warning');
    expect(result.steps[1]).toMatchObject({
      status: 'unclear',
      message: 'Nicht prüfbar: Die Nachricht kommt an. Die Seite zeigt ein Captcha.',
    });
    expect(result.steps[2]?.status).toBe('passed');
  });

  it('tells the AI what went wrong, so it can try another way', async () => {
    const { drive, seen } = script(
      { type: 'click', target: role('button', 'Senden'), timeoutMs: 500 },
      verdict(met('Ok.')),
    );
    await run([open, goalStep('Senden geht.')], { ai: drive });
    expect(seen[1]?.history[0]?.result).toMatch(
      /^Element nicht gefunden: Rolle „button“ mit Name „Senden“/,
    );
  });

  it('opens only pages of the website under test', async () => {
    const { drive, seen } = script(
      { type: 'open', url: 'https://example.org/' },
      { type: 'open', url: '/danke.html' },
      verdict(met('Ok.')),
    );
    const result = await run([open, goalStep('Geh weiter.')], { ai: drive });
    expect(seen[1]?.history[0]?.result).toBe('nicht erlaubt: nur Seiten der getesteten Website');
    expect(seen[2]?.history[1]?.result).toBe('ok');
    expect(result.status).toBe('passed');
  });

  it('never shows the AI a secret: masked in text and address, no screenshot then', async () => {
    const { drive, seen } = script(
      { type: 'click', target: role('button', 'Alle akzeptieren') },
      { type: 'fill', target: { by: 'label', label: 'Name' }, value: '{{secret.kunde}}' },
      { type: 'click', target: role('button', 'Absenden') },
      verdict(met('Ok.')),
    );
    const result = await run([open, goalStep('Trag den Kunden ein.')], {
      ai: drive,
      secrets: { kunde: 'Geheim-4711' },
    });
    expect(result.status).toBe('passed');
    expect(seen[0]?.secretNames).toEqual(['kunde']);
    expect(JSON.stringify(seen)).not.toContain('Geheim-4711');
    // Before typing: a screenshot. With the secret in the field and on the page: none.
    expect(seen[0]?.page.screenshot).toBeDefined();
    expect(seen[2]?.page.screenshot).toBeUndefined();
    expect(seen[3]?.page.screenshot).toBeUndefined();
    // The thank-you page greets with the name, which is the secret here.
    expect(seen[3]?.page.snapshot).toMatch(/Hallo •+/);
    expect(seen[3]?.page.url).toMatch(/name=•+$/);
    expect(result.screenshots).toEqual([]);
  });

  it(`asks for the verdict after ${MAX_AI_ACTIONS} actions`, async () => {
    const seen: AgentInput[] = [];
    const drive = async (input: AgentInput): Promise<AgentAction> => {
      seen.push(input);
      if (input.final) {
        return {
          kind: 'verdict',
          criteria: [{ goal: 'X', status: 'unknown', evidence: 'Zu weit.' }],
          summary: SUMMARY,
        };
      }
      return {
        kind: 'step',
        step: flowSchema.parse({
          version: 1,
          steps: [
            { id: 'ki', type: 'scroll', to: { kind: 'by', direction: 'down', distance: 10 } },
          ],
        }).steps[0] as never,
      };
    };
    const result = await run([open, goalStep('Scroll für immer.')], { ai: drive });
    expect(seen).toHaveLength(MAX_AI_ACTIONS + 1);
    expect(seen.at(-1)?.final).toBe(true);
    expect(result.steps[1]).toMatchObject({ status: 'unclear' });
    expect(result.steps[1]?.aiActions).toHaveLength(MAX_AI_ACTIONS);
  });

  it('fails when the AI still sends an action instead of its verdict', async () => {
    const drive = async (): Promise<AgentAction> => ({
      kind: 'step',
      step: flowSchema.parse({
        version: 1,
        steps: [{ id: 'ki', type: 'scroll', to: { kind: 'bottom' } }],
      }).steps[0] as never,
    });
    const result = await run([open, goalStep('Los.')], { ai: drive });
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: `Die KI hat nach ${MAX_AI_ACTIONS} Aktionen keine Bewertung geliefert.`,
    });
  });

  it('says what is missing when no AI provider is set up', async () => {
    const result = await run([open, goalStep('Formular kommt an.')]);
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: 'Kein KI-Anbieter eingerichtet: unter „Einstellungen → KI & API“ einen speichern.',
    });
  });

  it('reports a problem with the AI provider in the step', async () => {
    const drive = async (): Promise<AgentAction> => {
      throw new Error('Der KI-Anbieter antwortet nicht (nach 60 s).');
    };
    const result = await run([open, goalStep('Los.')], { ai: drive });
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message: 'KI-Anbieter: Der KI-Anbieter antwortet nicht (nach 60 s).',
      aiActions: [],
    });
  });
});

describe('AI steps – pages that load their content after the page is open', () => {
  const spa = { id: 'spa', type: 'open', url: '/spa.html' };

  it('waits until the spinner is gone, so the AI sees the content and not the loading indicator', async () => {
    const { drive, seen } = script(verdict(met('Die Seite hat eine h1.')));
    await run([spa, goalStep('Prüfe, ob es eine h1 gibt.')], { ai: drive });
    expect(seen[0]?.page.snapshot).toContain('heading "Seehaus 7"');
    expect(seen[0]?.page.snapshot).not.toContain('progressbar');
  });

  it('also waits after an action, e.g. a click that loads the next page', async () => {
    const { drive, seen } = script(
      { type: 'open', url: '/spa.html' },
      verdict(met('Die Seite hat eine h1.')),
    );
    await run([open, goalStep('Prüfe, ob es eine h1 gibt.')], { ai: drive });
    expect(seen[1]?.page.snapshot).toContain('heading "Seehaus 7"');
  });

  it('does not wait forever for a page that never comes to rest', async () => {
    const { drive } = script(verdict(met('Egal.')));
    const started = Date.now();
    await run([{ id: 'u', type: 'open', url: '/unruhig.html' }, goalStep('Egal.')], { ai: drive });
    expect(Date.now() - started).toBeLessThan(15_000);
  });
});

describe('AI steps – measuring and the result of the test', () => {
  const farben = { id: 'farben', type: 'open', url: '/farben.html' };
  const h1 = { by: 'role', role: 'heading', name: 'Seehaus 7' };

  it('reads the computed colour of an element and gives the AI the exact value', async () => {
    const { drive, seen } = script(
      { type: 'inspect', target: h1 },
      verdict(met('Die h1 ist rot.')),
    );
    const result = await run([farben, goalStep('Prüfe die Schriftfarbe der h1.')], { ai: drive });

    // The second round already knows the measured value.
    expect(seen[1]?.history).toEqual([
      {
        action: { type: 'inspect', target: h1 },
        result: expect.stringContaining('Schriftfarbe rgb(200, 0, 0) / #C80000'),
      },
    ]);
    expect(result.steps[1]?.aiActions).toEqual([
      expect.stringMatching(/^Eigenschaften gelesen: .*Schriftfarbe rgb\(200, 0, 0\) \/ #C80000/),
    ]);
    expect(result.status).toBe('passed');
  });

  it('tells the AI when the element is not there, instead of failing the step', async () => {
    const { drive, seen } = script(
      { type: 'inspect', target: { by: 'role', role: 'heading', name: 'Gibt es nicht' } },
      verdict(met('Egal.')),
    );
    const result = await run([farben, goalStep('Prüfe die Farbe.')], { ai: drive });
    expect(seen[1]?.history[0]?.result).toMatch(/Element nicht gefunden/);
    expect(result.status).toBe('passed');
  });

  it('keeps the result of the test with the step, to show as "Testergebnis"', async () => {
    const { drive } = script({
      ...verdict(met('Die h1 ist rot.')),
      summary: 'h1-Überschriften sind rot (#C80000)',
    });
    const result = await run([farben, goalStep('Prüfe die Schriftfarbe der h1.')], { ai: drive });
    expect(result.steps[1]?.aiSummary).toBe('h1-Überschriften sind rot (#C80000)');
    expect(result.steps[0]?.aiSummary).toBeUndefined();
  });

  it('masks a secret in the result of the test', async () => {
    const { drive } = script({
      ...verdict(met('Egal.')),
      summary: 'Der Name ist geheim-123.',
    });
    const result = await run([farben, goalStep('Egal.')], {
      ai: drive,
      secrets: { passwort: 'geheim-123' },
    });
    expect(result.steps[1]?.aiSummary).not.toContain('geheim-123');
  });

  it('counts an inspect like any action toward the limit', async () => {
    const inspections = Array.from({ length: MAX_AI_ACTIONS }, () => ({
      type: 'inspect',
      target: h1,
    }));
    const { drive, seen } = script(...inspections, verdict(met('Egal.')));
    await run([farben, goalStep('Egal.')], { ai: drive });
    expect(seen[MAX_AI_ACTIONS]?.final).toBe(true);
  });
});
