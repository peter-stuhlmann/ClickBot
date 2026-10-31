import { flowSchema, type Flow } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { createGa4Recorder } from './analytics';
import { runFlow, type RunOptions } from './run-flow';
import { executeStep } from './steps';
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

describe('runFlow – GA4 marking switched off by the job', () => {
  it('sends the GA4 requests of the website unchanged', async () => {
    const context = await browser.newContext();
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
        analyticsMarking: {
          debugMode: false,
          internalTraffic: false,
          botFlag: false,
          runNumber: false,
        },
      });
    } finally {
      await context.close();
    }

    expect(sent).toHaveLength(2);
    for (const url of sent) {
      const params = new URL(url).searchParams;
      expect(
        ['_dbg', 'ep.traffic_type', 'ep.click_bot', 'epn.click_bot_run'].filter((key) =>
          params.has(key),
        ),
      ).toEqual([]);
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

describe('runFlow – elements in iframes, e.g. cookie banners', () => {
  it('clicks a button inside an iframe that loads late', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/consent-iframe.html' }),
      step('consent', { type: 'click', target: role('button', 'Einwilligen und weiter') }),
      step('done', {
        type: 'assert',
        assertion: { kind: 'textVisible', text: 'Einwilligung gespeichert.' },
      }),
    ]);
    expect(result.steps.map((s) => [s.stepId, s.status, s.message])).toEqual([
      ['open', 'passed', undefined],
      ['consent', 'passed', undefined],
      ['done', 'passed', undefined],
    ]);
  });

  it('sees text inside an iframe', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/consent-iframe.html' }),
      step('banner', {
        type: 'assert',
        assertion: { kind: 'textVisible', text: 'Herzlich willkommen!' },
      }),
    ]);
    expect(result.status).toBe('passed');
  });

  it('refuses to guess when the page and an iframe both have the element', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/consent-iframe.html' }),
      step('wait', {
        type: 'wait',
        until: { kind: 'element', target: role('button', 'Einwilligen und weiter') },
      }),
      step('both', { type: 'click', target: { by: 'text', text: 'Kontakt', exact: true } }),
    ]);
    expect(result.steps[2]).toMatchObject({
      status: 'failed',
      message: 'Mehrdeutig: Text „Kontakt“ passt auf 2 Elemente.',
    });
  });
});

describe('runFlow – .htaccess password protection', () => {
  const protectedPage = [
    step('auth', { type: 'basicAuth', username: 'demo', password: '{{secret.staging}}' }),
    step('open', { type: 'open', url: '/geschuetzt' }),
    step('see', {
      type: 'assert',
      assertion: { kind: 'textVisible', text: 'Geschützter Bereich' },
    }),
  ];

  it('opens a protected page with user name and password', async () => {
    const result = await run(protectedPage, { secrets: { staging: 'geheim-123' } });
    expect(result.status).toBe('passed');
  });

  it('explains a wrong password, without showing it', async () => {
    const result = await run(protectedPage, { secrets: { staging: 'falsch-falsch' } });
    expect(result.steps[1]).toMatchObject({
      status: 'failed',
      message:
        'Seite antwortet mit HTTP 401: Sie ist passwortgeschützt, Benutzername oder Passwort stimmen nicht.',
    });
    expect(JSON.stringify(result)).not.toContain('falsch-falsch');
  });

  it('says what is missing when a protected page is opened without the step', async () => {
    const result = await run([step('open', { type: 'open', url: '/geschuetzt' })]);
    expect(result.steps[0]?.message).toBe(
      'Seite antwortet mit HTTP 401: Sie ist passwortgeschützt. Davor gehört ein Schritt „Passwortschutz“.',
    );
  });

  it('uses the newest credentials when the step comes twice', async () => {
    const result = await run(
      [
        step('auth-old', { type: 'basicAuth', username: 'demo', password: 'alt-passwort' }),
        step('auth', { type: 'basicAuth', username: 'demo', password: '{{secret.staging}}' }),
        ...protectedPage.slice(1),
      ],
      { secrets: { staging: 'geheim-123' } },
    );
    expect(result.status).toBe('passed');
  });
});

describe('runFlow – links that open a new tab', () => {
  const start = step('open', { type: 'open', url: '/neuer-tab.html' });
  const passed = (result: Awaited<ReturnType<typeof run>>) =>
    result.steps.map((s) => [s.stepId, s.status, s.message]);

  it('goes on in the tab a link opens', async () => {
    const result = await run([
      start,
      step('tab', { type: 'click', target: role('link', 'Danke im neuen Tab') }),
      step('thanks', { type: 'assert', assertion: { kind: 'textVisible', text: 'Vielen Dank' } }),
      step('url', { type: 'assert', assertion: { kind: 'urlContains', value: 'ticket=T-1' } }),
      step('ticket', { type: 'extract', target: { by: 'testId', testId: 'ticket' }, saveAs: 't' }),
    ]);
    expect(passed(result).filter(([, status]) => status !== 'passed')).toEqual([]);
    expect(result.extracted).toEqual({ t: 'T-1' });
  });

  it('goes on in a tab the page opens by script', async () => {
    const result = await run([
      start,
      step('tab', { type: 'click', target: role('button', 'Per Skript öffnen') }),
      step('url', { type: 'assert', assertion: { kind: 'urlContains', value: 'ticket=T-2' } }),
    ]);
    expect(result.steps.map((s) => s.message)).toEqual([undefined, undefined, undefined]);
  });

  it('shows a PDF opened in a new tab, so the bot can check and photograph it', async () => {
    const result = await run([
      start,
      step('cv', { type: 'click', target: role('link', 'Curriculum vitae (PDF)') }),
      step('url', { type: 'assert', assertion: { kind: 'urlContains', value: 'lebenslauf.pdf' } }),
      step('shot', { type: 'screenshot', fullPage: false }),
    ]);
    expect(passed(result).filter(([, status]) => status !== 'passed')).toEqual([]);
    expect(result.screenshots).toHaveLength(1);
  });

  it('lets a click into a new tab end once that tab has loaded, so a photo shows it', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/neuer-tab.html`);
      const [click] = flow([
        step('tab', { type: 'click', target: role('link', 'Bilder im neuen Tab') }),
      ]).steps;
      if (!click) throw new Error('no step');
      await executeStep(page, click, {
        vars: { runNr: 1, botNr: 1, faker: () => undefined, secrets: {} },
        baseUrl: browser.origin(),
        analytics: createGa4Recorder(),
      });
      const tab = context.pages().at(-1);
      expect(tab?.url()).toBe(`${browser.origin()}/bilder.html`);
      expect(await tab?.evaluate(() => document.readyState)).toBe('complete');
    } finally {
      await context.close();
    }
  });

  it('stays in its tab for links without a new tab', async () => {
    const result = await run([
      start,
      step('same', { type: 'click', target: role('link', 'Danke im selben Tab') }),
      step('url', { type: 'assert', assertion: { kind: 'urlContains', value: 'ticket=T-3' } }),
    ]);
    expect(result.status).toBe('passed');
  });

  it('photographs the new tab when a step there fails', async () => {
    const result = await run([
      start,
      step('tab', { type: 'click', target: role('link', 'Danke im neuen Tab') }),
      step('missing', {
        type: 'click',
        target: role('button', 'Downloads'),
        timeoutMs: 1_000,
      }),
    ]);
    expect(result.steps[2]).toMatchObject({ status: 'failed' });
    expect(result.screenshots.map((shot) => shot.stepId)).toEqual(['missing']);
  });
});

describe('runFlow – scrolling and keys', () => {
  const start = step('open', { type: 'open', url: '/lang.html' });
  const position = step('pos', {
    type: 'extract',
    target: { by: 'testId', testId: 'position' },
    saveAs: 'y',
  });
  // The page shows its position on "scroll", which the browser fires with the next frame.
  const scrolled = step('scrolled', {
    type: 'wait',
    until: { kind: 'element', target: { by: 'testId', testId: 'gescrollt' } },
  });
  const pressed = step('key', {
    type: 'extract',
    target: { by: 'testId', testId: 'taste' },
    saveAs: 'key',
  });
  const maxScroll = 3 * 900 + 200;

  it('scrolls to a position, even on a page that scrolls smoothly', async () => {
    const result = await run([
      start,
      step('scroll', { type: 'scroll', to: { kind: 'position', y: 1200 } }),
      scrolled,
      position,
    ]);
    expect(result.extracted).toEqual({ y: '1200' });
  });

  it('scrolls until an element is in view', async () => {
    const result = await run([
      start,
      step('scroll', {
        type: 'scroll',
        to: { kind: 'element', target: { by: 'role', role: 'heading', name: 'Kontakt' } },
      }),
      scrolled,
      position,
    ]);
    expect(Number(result.extracted.y)).toBeGreaterThan(900);
  });

  it('scrolls to the end of the page', async () => {
    const result = await run([
      start,
      step('scroll', { type: 'scroll', to: { kind: 'bottom' } }),
      scrolled,
      position,
    ]);
    expect(Number(result.extracted.y)).toBeGreaterThan(maxScroll - 900);
  });

  /** Waits until the page stands exactly there; it fails the run after 2 s. */
  const standsAt = (selector: string) =>
    step(`at-${selector}`, {
      type: 'wait',
      until: { kind: 'element', target: { by: 'css', selector: `body${selector}` } },
      timeoutMs: 2_000,
    });
  const scroll = (id: string, to: Record<string, unknown>) => step(id, { type: 'scroll', to });

  it('scrolls from where the page stands, in every direction', async () => {
    const result = await run([
      start,
      scroll('to', { kind: 'position', y: 1200, x: 600 }),
      scroll('down', { kind: 'by', direction: 'down', distance: 300 }),
      scroll('up', { kind: 'by', direction: 'up', distance: 500 }),
      scroll('right', { kind: 'by', direction: 'right', distance: 200 }),
      scroll('left', { kind: 'by', direction: 'left', distance: 300 }),
      standsAt('[data-x="500"][data-y="1000"]'),
    ]);
    expect(result.status).toBe('passed');
  });

  it('keeps the horizontal position when a position has none', async () => {
    const result = await run([
      start,
      scroll('right', { kind: 'position', y: 0, x: 600 }),
      scroll('down', { kind: 'position', y: 1200 }),
      standsAt('[data-x="600"][data-y="1200"]'),
    ]);
    expect(result.status).toBe('passed');
  });

  it('scrolls to every edge of the page', async () => {
    const result = await run([
      start,
      scroll('to', { kind: 'position', y: 1200, x: 600 }),
      scroll('top', { kind: 'top' }),
      scroll('left', { kind: 'left' }),
      standsAt('[data-x="0"][data-y="0"]'),
      scroll('right', { kind: 'right' }),
      scroll('bottom', { kind: 'bottom' }),
      standsAt(':not([data-x="0"]):not([data-y="0"])'),
      position,
    ]);
    expect(result.status).toBe('passed');
    expect(Number(result.extracted.y)).toBeGreaterThan(maxScroll - 900);
  });

  it('scrolls sideways to an element right of the view, at the height of the view', async () => {
    const result = await run([
      start,
      scroll('to', {
        kind: 'element',
        target: { by: 'role', role: 'heading', name: 'Ganz rechts' },
      }),
      standsAt('[data-x]:not([data-x="0"])[data-y="0"]'),
    ]);
    expect(result.status).toBe('passed');
  });

  it('presses a key, e.g. Escape to close a dialog', async () => {
    const result = await run([
      start,
      step('esc', { type: 'press', key: 'Escape' }),
      step('closed', {
        type: 'assert',
        assertion: { kind: 'textVisible', text: 'Dialog geschlossen' },
      }),
    ]);
    expect(result.status).toBe('passed');
  });

  it('presses a key combination on an element, which gets the focus first', async () => {
    const result = await run([
      start,
      step('combo', { type: 'press', key: 'Control+k', target: { by: 'label', label: 'Suche' } }),
      pressed,
    ]);
    expect(result.extracted).toEqual({ key: 'Control+k' });
  });

  it('knows the space bar by its name', async () => {
    const result = await run([
      start,
      step('space', { type: 'press', key: 'Shift+Space' }),
      pressed,
    ]);
    expect(result.extracted).toEqual({ key: 'Shift+Space' });
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

  it('fails ai steps clearly until they are supported', async () => {
    const result = await run([step('x', { type: 'ai', instruction: 'Akzeptiere Cookies' })]);
    expect(result.steps[0]?.message).toBe('KI-Schritte sind noch nicht verfügbar.');
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

  it('says what a CSS selector like „decline“ really looks for', async () => {
    const result = await run([
      step('open', { type: 'open', url: '/kontakt.html' }),
      step('decline', {
        type: 'click',
        target: { by: 'css', selector: 'decline' },
        timeoutMs: 300,
      }),
    ]);
    expect(result.steps[1]?.message).toBe(
      'Element nicht gefunden: CSS „decline“ (nach 0,3 s). „decline“ sucht ein Element <decline>, das es in HTML nicht gibt. Gemeint ist wohl .decline (Klasse) oder #decline (ID).',
    );
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
