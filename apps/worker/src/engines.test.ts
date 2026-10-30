import { flowSchema, type Flow } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { contextOptionsFor } from './devices';
import { runFlow } from './run-flow';

const flow = (steps: unknown[]): Flow => flowSchema.parse({ version: 1, steps });
const role = (r: string, name: string) => ({ by: 'role', role: r, name });

// The everyday steps, checked in the two engines besides Chromium (all other tests use Chromium).
describe.each([
  ['firefox', 'desktop'],
  ['firefox', 'android'],
  ['webkit', 'desktop'],
  ['webkit', 'iphone'],
] as const)('runFlow in %s on %s', (engine, device) => {
  const browser = useBrowser(engine);

  async function run(steps: unknown[], secrets: Record<string, string> = {}) {
    const context = await browser.newContext(contextOptionsFor(device, engine, browser.version()));
    const sent: string[] = [];
    await context.route(/\/g\/collect/, (route) => {
      sent.push(route.request().url());
      return route.fallback();
    });
    try {
      const result = await runFlow(context, flow(steps), {
        baseUrl: browser.origin(),
        runNr: 9,
        botNr: 1,
        secrets,
      });
      return { result, sent };
    } finally {
      await context.close();
    }
  }

  it('sends the contact form and marks its GA4 request as a bot run', async () => {
    const { result, sent } = await run([
      { id: 'open', type: 'open', url: '/kontakt.html' },
      { id: 'cookies', type: 'click', target: role('button', 'Alle akzeptieren') },
      { id: 'name', type: 'fill', target: { by: 'label', label: 'Name' }, value: 'Bot 1' },
      {
        id: 'mail',
        type: 'fill',
        target: { by: 'label', label: 'E-Mail' },
        value: 'a@example.com',
      },
      { id: 'send', type: 'click', target: role('button', 'Absenden') },
      { id: 'thanks', type: 'assert', assertion: { kind: 'textVisible', text: 'Vielen Dank' } },
      { id: 'ga', type: 'analytics', provider: 'ga4', event: 'generate_lead' },
    ]);
    expect(result.steps.filter((step) => step.status !== 'passed')).toEqual([]);
    expect(sent.length).toBeGreaterThan(0);
    for (const url of sent) {
      expect(new URL(url).searchParams.get('epn.click_bot_run')).toBe('9');
    }
  });

  it('goes on in the tab a link or a script opens', async () => {
    const { result } = await run([
      { id: 'open', type: 'open', url: '/neuer-tab.html' },
      { id: 'link', type: 'click', target: role('link', 'Danke im neuen Tab') },
      { id: 'tab', type: 'assert', assertion: { kind: 'urlContains', value: 'ticket=T-1' } },
      { id: 'back', type: 'open', url: '/neuer-tab.html' },
      { id: 'script', type: 'click', target: role('button', 'Per Skript öffnen') },
      { id: 'popup', type: 'assert', assertion: { kind: 'urlContains', value: 'ticket=T-2' } },
    ]);
    expect(result.steps.filter((step) => step.status !== 'passed')).toEqual([]);
  });

  it('clicks the consent button inside an iframe', async () => {
    const { result } = await run([
      { id: 'open', type: 'open', url: '/consent-iframe.html' },
      { id: 'consent', type: 'click', target: role('button', 'Einwilligen und weiter') },
      {
        id: 'done',
        type: 'assert',
        assertion: { kind: 'textVisible', text: 'Einwilligung gespeichert.' },
      },
    ]);
    expect(result.status).toBe('passed');
  });

  it('opens a page behind .htaccess', async () => {
    const { result } = await run(
      [
        { id: 'auth', type: 'basicAuth', username: 'demo', password: '{{secret.staging}}' },
        { id: 'open', type: 'open', url: '/geschuetzt' },
        {
          id: 'see',
          type: 'assert',
          assertion: { kind: 'textVisible', text: 'Geschützter Bereich' },
        },
      ],
      { staging: 'geheim-123' },
    );
    expect(result.status).toBe('passed');
  });
});
