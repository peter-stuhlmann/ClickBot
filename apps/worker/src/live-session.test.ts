import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import {
  LIVE_VIEWPORT,
  parseClientMessage,
  startLiveSession,
  type ServerMessage,
} from './live-session';

const browser = useBrowser();

async function open(path: string) {
  const context = await browser.newContext({ viewport: LIVE_VIEWPORT });
  const messages: ServerMessage[] = [];
  const session = await startLiveSession(context, `${browser.origin()}${path}`, (message) =>
    messages.push(message),
  );
  const steps = () => messages.flatMap((m) => (m.type === 'step' ? [m.step] : []));
  const [page] = context.pages();
  if (!page) throw new Error('The session opened no page.');
  /** Centre of an element in page coordinates, where a user would click in the stream. */
  const centre = async (selector: string) => {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error(`${selector} is not visible.`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  return { session, messages, steps, page, centre };
}

describe('parseClientMessage', () => {
  it.each([
    ['{"type":"click","x":10,"y":20}', { type: 'click', x: 10, y: 20 }],
    ['{"type":"wheel","dx":0,"dy":300}', { type: 'wheel', dx: 0, dy: 300 }],
    ['{"type":"key","key":"Enter"}', { type: 'key', key: 'Enter' }],
    ['{"type":"text","text":"Lena"}', { type: 'text', text: 'Lena' }],
    [
      '{"type":"navigate","url":"https://beispiel.de"}',
      { type: 'navigate', url: 'https://beispiel.de' },
    ],
    ['{"type":"mode","mode":"assert"}', { type: 'mode', mode: 'assert' }],
    ['{"type":"back"}', { type: 'back' }],
    ['{"type":"key","key":"Control+a"}', { type: 'key', key: 'Control+a' }],
    ['{"type":"key","key":"Shift+Tab"}', { type: 'key', key: 'Shift+Tab' }],
    ['{"type":"screenshot"}', { type: 'screenshot' }],
  ])('accepts %s', (raw, message) => {
    expect(parseClientMessage(raw)).toEqual(message);
  });

  it.each([
    ['not JSON', 'click'],
    ['an unknown type', '{"type":"evaluate","code":"process.exit()"}'],
    ['a click outside the viewport', '{"type":"click","x":5000,"y":10}'],
    ['a function key, which opens tools of the browser', '{"type":"key","key":"F12"}'],
    ['a key that is no key name', '{"type":"key","key":"Strg+A"}'],
    ['the browsing mode, which records nothing and is gone', '{"type":"mode","mode":"browse"}'],
    ['text that is too long', JSON.stringify({ type: 'text', text: 'x'.repeat(2001) })],
    ['an address that is no web address', '{"type":"navigate","url":"file:///etc/passwd"}'],
    ['an unknown mode', '{"type":"mode","mode":"debug"}'],
  ])('refuses %s', (_case, raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });
});

describe('startLiveSession', () => {
  it('opens the start page, streams it and records opening it as the first step', async () => {
    const { session, messages, steps } = await open('/aufnahme.html');
    expect(messages[0]).toEqual({
      type: 'ready',
      viewport: LIVE_VIEWPORT,
      url: `${browser.origin()}/aufnahme.html`,
    });
    expect(steps()).toEqual([{ type: 'open', url: `${browser.origin()}/aufnahme.html` }]);
    await expect.poll(() => messages.some((m) => m.type === 'frame')).toBe(true);
    await session.close();
  });

  it('turns clicks and typing from the stream into steps', async () => {
    const { session, steps, centre } = await open('/aufnahme.html');
    await session.handle({ type: 'click', ...(await centre('#user')) });
    await session.handle({ type: 'text', text: 'lena' });
    await session.handle({ type: 'click', ...(await centre('button[type=submit]')) });

    await expect.poll(() => steps().length).toBe(3);
    expect(steps().slice(1)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Benutzername' }, value: 'lena' },
      { type: 'click', target: { by: 'role', role: 'button', name: 'Anmelden' } },
    ]);
    await session.close();
  });

  it('records typing an address as opening it, and reports the new address', async () => {
    const { session, steps, messages } = await open('/aufnahme.html');
    await session.handle({ type: 'navigate', url: `${browser.origin()}/kontakt.html` });

    expect(steps().at(-1)).toEqual({ type: 'open', url: `${browser.origin()}/kontakt.html` });
    await expect
      .poll(() => messages.filter((m) => m.type === 'url').at(-1))
      .toEqual({ type: 'url', url: `${browser.origin()}/kontakt.html` });
    await session.close();
  });

  it('checks an element instead of clicking it, then records again', async () => {
    const { session, steps, messages, centre, page } = await open('/aufnahme.html');
    await session.handle({ type: 'mode', mode: 'assert' });
    await session.handle({ type: 'click', ...(await centre('nav a')) });

    await expect.poll(() => steps().length).toBe(2);
    expect(steps()[1]).toEqual({
      type: 'assert',
      assertion: { kind: 'elementVisible', target: { by: 'role', role: 'link', name: 'Kontakt' } },
    });
    expect(page.url()).toMatch(/aufnahme\.html$/);
    await expect
      .poll(() => messages.filter((m) => m.type === 'mode').at(-1))
      .toEqual({ type: 'mode', mode: 'record' });
    await session.close();
  });

  it('shows a PDF a link opens in a new tab, in the same view, and records the click', async () => {
    const { session, steps, messages, centre, page } = await open('/neuer-tab.html');
    await session.handle({ type: 'click', ...(await centre('a[href="lebenslauf.pdf"]')) });

    await expect
      .poll(() => messages.filter((m) => m.type === 'url').at(-1))
      .toEqual({ type: 'url', url: `${browser.origin()}/lebenslauf.pdf` });
    expect(page.url()).toBe(`${browser.origin()}/lebenslauf.pdf`);
    expect(steps().at(-1)).toEqual({
      type: 'click',
      target: { by: 'role', role: 'link', name: 'Curriculum vitae (PDF)' },
    });
    // The run follows the new tab after this click, like the live view did.
    expect(messages.filter((m) => m.type === 'error')).toEqual([]);
    await session.close();
  });

  it('records scrolling, a photo and keys in between, in the order they happened', async () => {
    const { session, steps } = await open('/lang.html');
    await session.handle({ type: 'move', x: 200, y: 300 });
    await session.handle({ type: 'wheel', dx: 0, dy: 900 });
    await expect.poll(() => steps().length).toBe(2);
    await session.handle({ type: 'screenshot' });
    await session.handle({ type: 'key', key: 'Escape' });

    await expect.poll(() => steps().length).toBe(4);
    expect(steps().slice(1)).toEqual([
      { type: 'scroll', to: { kind: 'position', y: expect.any(Number) } },
      { type: 'screenshot' },
      { type: 'press', key: 'Escape' },
    ]);
    await session.close();
  });

  it('types text key by key, so the page sees the keys', async () => {
    const { session, page, centre } = await open('/lang.html');
    await session.handle({ type: 'click', ...(await centre('#suche')) });
    await session.handle({ type: 'text', text: 'ab' });
    await expect.poll(() => page.getByTestId('taste').textContent()).toBe('b');
    await session.close();
  });

  it('says so when the start page cannot be opened, and stays usable', async () => {
    const { session, messages } = await open('/fehler');
    expect(messages).toContainEqual({ type: 'error', message: 'Seite antwortet mit HTTP 500.' });
    await session.handle({ type: 'navigate', url: `${browser.origin()}/kontakt.html` });
    await expect
      .poll(() => messages.filter((m) => m.type === 'url').at(-1))
      .toEqual({ type: 'url', url: `${browser.origin()}/kontakt.html` });
    await session.close();
  });
});
