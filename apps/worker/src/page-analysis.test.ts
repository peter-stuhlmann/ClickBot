import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { analysePage, detectConsentTool } from './page-analysis';

const browser = useBrowser();

async function analyse(path: string) {
  const context = await browser.newContext();
  try {
    return await analysePage(context, `${browser.origin()}${path}`);
  } finally {
    await context.close();
  }
}

describe('analysePage', () => {
  it('reads title, forms, the accessibility tree and the GA4 id of a page', async () => {
    const facts = await analyse('/kontakt.html');
    expect(facts).toMatchObject({
      url: `${browser.origin()}/kontakt.html`,
      title: 'Kontakt – Beispiel GmbH',
      forms: 1,
      requiredFields: 0,
      cookieBanner: null,
      ga4: ['G-TEST'],
    });
    expect(facts.snapshot).toContain('button "Alle akzeptieren"');
    expect(facts.snapshot).toContain('textbox "Name"');
    expect(facts.snapshot).toContain('button "Absenden"');
  });

  it('marks the GA4 requests of the page as bot traffic, like every run', async () => {
    const context = await browser.newContext();
    const sent: string[] = [];
    await context.route(/\/g\/collect/, (route) => {
      sent.push(route.request().url());
      return route.fallback();
    });
    try {
      const facts = await analysePage(context, `${browser.origin()}/ga-sofort.html`);
      expect(facts.ga4).toEqual(['G-SOFORT']);
    } finally {
      await context.close();
    }
    expect(sent).toHaveLength(1);
    const params = new URL(sent[0] as string).searchParams;
    expect(params.get('_dbg')).toBe('1');
    expect(params.get('ep.traffic_type')).toBe('internal');
    expect(params.get('epn.click_bot_run')).toBe('0');
  });

  it('includes iframes that load late, where cookie banners often live', async () => {
    const facts = await analyse('/consent-iframe.html');
    expect(facts.snapshot).toMatch(/# iframe .*\/consent-frame\.html/);
    expect(facts.snapshot).toContain('Einwilligen und weiter');
  });

  it.each([
    ['/fehler', 'Seite antwortet mit HTTP 500.'],
    ['/geschuetzt', 'Seite ist passwortgeschützt (HTTP 401).'],
  ])('explains why %s could not be read', async (path, message) => {
    await expect(analyse(path)).rejects.toThrow(message);
  });
});

describe('detectConsentTool', () => {
  it.each([
    ['https://app.usercentrics.eu/browser-ui/latest/loader.js', 'Usercentrics'],
    ['https://consent.cookiebot.com/uc.js', 'Cookiebot'],
    ['https://cdn.cookielaw.org/scripttemplates/otSDKStub.js', 'OneTrust'],
    ['https://beispiel.de/wp-content/plugins/borlabs-cookie/js/borlabs.js', 'Borlabs Cookie'],
  ])('recognises %s', (url, tool) => {
    expect(detectConsentTool(['https://beispiel.de/app.js', url])).toBe(tool);
  });

  it('is null without a known consent tool', () => {
    expect(detectConsentTool(['https://beispiel.de/app.js'])).toBeNull();
  });
});
