import { flowSchema, type Flow } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { runFlow, type RunOptions } from './run-flow';
import { createTestData } from './test-data';

const browser = useBrowser();

const flow = (steps: unknown[]): Flow => flowSchema.parse({ version: 1, steps });
const step = (id: string, fields: Record<string, unknown>) => ({ id, ...fields });
const role = (r: string, name: string) => ({ by: 'role', role: r, name });

async function run(steps: unknown[], options: Partial<RunOptions> = {}) {
  const context = await browser.newContext();
  try {
    return await runFlow(context, flow(steps), {
      baseUrl: browser.origin(),
      runNr: 7,
      botNr: 3,
      secrets: {},
      ...options,
    });
  } finally {
    await context.close();
  }
}

const contactFlow = [
  step('open', { type: 'open', url: '/kontakt.html' }),
  step('cookies', { type: 'click', target: role('button', 'Alle akzeptieren') }),
  step('name', { type: 'fill', target: { by: 'label', label: 'Name' }, value: '{{faker.name}}' }),
  step('mail', {
    type: 'fill',
    target: { by: 'label', label: 'E-Mail' },
    value: '{{faker.email}}',
  }),
  step('topic', { type: 'select', target: { by: 'label', label: 'Anliegen' }, option: 'Support' }),
  step('send', { type: 'click', target: role('button', 'Absenden') }),
  step('thanks', { type: 'assert', assertion: { kind: 'textVisible', text: 'Vielen Dank' } }),
  step('url', { type: 'assert', assertion: { kind: 'urlContains', value: '/danke' } }),
  step('title', { type: 'assert', assertion: { kind: 'titleContains', value: 'Danke' } }),
  step('ticket', {
    type: 'extract',
    target: { by: 'testId', testId: 'ticket' },
    saveAs: 'ticketNr',
  }),
  step('greeting', { type: 'extract', target: { by: 'css', selector: '#greeting' }, saveAs: 'hi' }),
  step('ga', { type: 'analytics', provider: 'ga4', event: 'generate_lead' }),
];

describe('runFlow – bot runs never count as real visits', () => {
  it('marks every GA4 request as debug and internal traffic of this run, before it leaves', async () => {
    const context = await browser.newContext();
    // Sees each request as it would reach the network: after the marking of runFlow.
    const sent: string[] = [];
    await context.route(/\/g\/collect/, (route) => {
      sent.push(route.request().url());
      return route.fallback();
    });
    try {
      await runFlow(context, flow(contactFlow), {
        baseUrl: browser.origin(),
        runNr: 42,
        botNr: 1,
        secrets: {},
      });
    } finally {
      await context.close();
    }

    expect(sent).toHaveLength(2);
    for (const url of sent) {
      const params = new URL(url).searchParams;
      expect(params.get('_dbg')).toBe('1');
      expect(params.get('ep.traffic_type')).toBe('internal');
      expect(params.get('ep.click_bot')).toBe('1');
      expect(params.get('epn.click_bot_run')).toBe('42');
    }
  });
});

describe('runFlow – happy path', () => {
  it('fills and sends the contact form and checks the result', async () => {
    const result = await run(contactFlow);

    expect(result.status).toBe('passed');
    expect(result.steps.map((s) => s.status)).toEqual(contactFlow.map(() => 'passed'));
    expect(result.extracted.ticketNr).toBe('A-20931');
    expect(result.analyticsEvents).toEqual(['page_view', 'generate_lead']);
  });

  it('fills fake data that is fixed per run and bot', async () => {
    const result = await run(contactFlow, { runNr: 7, botNr: 3 });
    expect(result.extracted.hi).toBe(`Hallo ${createTestData(7, 3)('name')}`);
  });

  it('measures each step', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('pause', { type: 'wait', until: { kind: 'duration', ms: 300 } }),
    ]);
    expect(result.steps[1]?.durationMs).toBeGreaterThanOrEqual(300);
  });

  it('waits for an element that appears late, without a fixed pause', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/langsam.html' }),
      step('next', { type: 'click', target: role('button', 'Weiter') }),
    ]);
    expect(result.status).toBe('passed');
  });

  it('supports waiting for an element and for network idle', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/langsam.html' }),
      step('idle', { type: 'wait', until: { kind: 'networkIdle' } }),
      step('el', {
        type: 'wait',
        until: { kind: 'element', target: { by: 'text', text: 'Weiter' } },
      }),
    ]);
    expect(result.status).toBe('passed');
  });

  it('shows a validation message when the name is missing', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('send', { type: 'click', target: role('button', 'Absenden') }),
      step('error', {
        type: 'assert',
        assertion: { kind: 'elementVisible', target: { by: 'role', role: 'alert' } },
      }),
    ]);
    expect(result.status).toBe('passed');
  });

  it('takes a PNG screenshot for a screenshot step', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('shot', { type: 'screenshot', name: 'Formular' }),
    ]);
    expect(result.screenshots).toHaveLength(1);
    expect(result.screenshots[0]?.stepId).toBe('shot');
    expect(result.screenshots[0]?.image.subarray(1, 4).toString()).toBe('PNG');
  });
});

describe('runFlow – failures', () => {
  it('stops at a missing element, explains it and skips the remaining steps', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('missing', { type: 'click', target: role('button', 'Gibt es nicht'), timeoutMs: 500 }),
      step('after', { type: 'click', target: role('button', 'Absenden') }),
    ]);

    expect(result.status).toBe('failed');
    expect(result.steps.map((s) => s.status)).toEqual(['passed', 'failed', 'skipped']);
    expect(result.steps[1]?.message).toBe(
      'Element nicht gefunden: Rolle „button“ mit Name „Gibt es nicht“ (nach 0,5 s).',
    );
  });

  it('attaches a screenshot of the moment a step failed', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('missing', { type: 'click', target: role('button', 'Gibt es nicht'), timeoutMs: 300 }),
    ]);
    expect(result.screenshots.map((s) => s.stepId)).toEqual(['missing']);
  });

  it('refuses to guess when a target matches several elements', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/langsam.html' }),
      step('link', { type: 'click', target: role('link', 'Kontakt'), timeoutMs: 500 }),
    ]);
    expect(result.steps[1]?.message).toBe(
      'Mehrdeutig: Rolle „link“ mit Name „Kontakt“ passt auf 2 Elemente.',
    );
  });

  it('fails when the page answers with an HTTP error', async () => {
    const result = await run([step('open', { type: 'open', url: '/fehler' })]);
    expect(result.steps[0]?.message).toBe('Seite antwortet mit HTTP 500.');
  });

  it('fails a text assertion with the expected text in the message', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('check', {
        type: 'assert',
        assertion: { kind: 'textVisible', text: 'Vielen Dank' },
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toBe('Text „Vielen Dank“ ist nicht sichtbar (nach 0,3 s).');
  });

  it('reports a GA4 event that was never sent, e.g. because cookies were rejected', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('cookies', { type: 'click', target: role('button', 'Ablehnen') }),
      step('name', { type: 'fill', target: { by: 'label', label: 'Name' }, value: 'Test' }),
      step('send', { type: 'click', target: role('button', 'Absenden') }),
      step('ga', { type: 'analytics', provider: 'ga4', event: 'generate_lead', timeoutMs: 500 }),
    ]);
    expect(result.steps[4]?.message).toBe(
      'GA4-Event „generate_lead“ wurde nicht gesendet (nach 0,5 s). Gesendet: keine.',
    );
  });

  it('names the events that were sent when the expected one is missing', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('cookies', { type: 'click', target: role('button', 'Alle akzeptieren') }),
      step('ga', { type: 'analytics', provider: 'ga4', event: 'form_submit', timeoutMs: 300 }),
    ]);
    expect(result.steps[2]?.message).toBe(
      'GA4-Event „form_submit“ wurde nicht gesendet (nach 0,3 s). Gesendet: page_view.',
    );
  });

  it('fails a step with an unknown variable before touching the page', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('iban', {
        type: 'fill',
        target: { by: 'label', label: 'Name' },
        value: '{{faker.iban}}',
      }),
    ]);
    expect(result.steps[1]?.message).toBe('Unbekannte Variable: {{faker.iban}}');
  });

  it('never puts a secret value into a step message', async () => {
    const result = await run(
      [
        step('open', { type: 'open', url: '/kontakt.html' }),
        step('check', {
          type: 'assert',
          assertion: { kind: 'textVisible', text: 'Passwort {{secret.pw}}' },
          timeoutMs: 300,
        }),
      ],
      { secrets: { pw: 'Geheim-123' } },
    );
    expect(result.steps[1]?.message).toBe('Text „Passwort ••••“ ist nicht sichtbar (nach 0,3 s).');
  });

  it.each([
    ['ai', { type: 'ai', instruction: 'Akzeptiere Cookies' }, 'KI-Schritte'],
    ['code', { type: 'code', source: 'await page.goto("/")' }, 'Code-Schritte'],
  ])('fails %s steps clearly until they are supported', async (_, fields, label) => {
    const result = await run([step('x', fields)]);
    expect(result.steps[0]?.message).toBe(`${label} sind noch nicht verfügbar.`);
  });

  it('reports the current URL when the expected one is not reached', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('url', {
        type: 'assert',
        assertion: { kind: 'urlContains', value: '/danke' },
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toBe(
      `URL enthält „/danke“ nicht (aktuell: ${browser.origin()}/kontakt.html).`,
    );
  });

  it('reports the current title when the expected one is not shown', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('title', {
        type: 'assert',
        assertion: { kind: 'titleContains', value: 'Danke' },
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toBe(
      'Seitentitel enthält „Danke“ nicht (aktuell: „Kontakt – Beispiel GmbH“).',
    );
  });

  it('gives up on a page that does not answer, without blocking on the failure screenshot', async () => {
    const started = Date.now();
    const result = await run([step('open', { type: 'open', url: '/haengt', timeoutMs: 300 })]);

    expect(result.steps[0]?.message).toBe('Seite lädt nicht (nach 0,3 s).');
    // The screenshot attempt gives up after its own short timeout instead of waiting 30 s.
    expect(result.screenshots).toEqual([]);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('gives up waiting for network idle on a page that keeps loading', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/unruhig.html' }),
      step('idle', { type: 'wait', until: { kind: 'networkIdle' }, timeoutMs: 500 }),
    ]);
    expect(result.steps[1]?.message).toBe('Seite kommt nicht zur Ruhe (nach 0,5 s).');
  });

  it('reports an element that never appears while waiting for it', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('el', {
        type: 'wait',
        until: { kind: 'element', target: { by: 'text', text: 'Fertig' } },
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toBe('Element nicht gefunden: Text „Fertig“ (nach 0,3 s).');
  });

  it('names the missing option instead of claiming the select field is missing', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('topic', {
        type: 'select',
        target: { by: 'label', label: 'Anliegen' },
        option: 'Reklamation',
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toBe(
      'Option „Reklamation“ gibt es in Feld „Anliegen“ nicht. Vorhanden: Bitte wählen, Angebot, Support.',
    );
  });

  it('passes on an unexpected browser error as its first line', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('fill', {
        type: 'fill',
        target: { by: 'role', role: 'heading', name: 'Kontakt aufnehmen' },
        value: 'x',
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toMatch(/not an <input>/);
    expect(result.steps[1]?.message).not.toContain('\n');
  });
});
