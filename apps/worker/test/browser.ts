import { chromium, type Browser, type BrowserContext } from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';

const GA_HOST = /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/;

/**
 * Starts Chromium and the fixture site once per test file. Contexts created through
 * `newContext` can only reach the fixture site; GA4 requests are answered locally with 204,
 * every other outside request is aborted, so no test ever touches the internet.
 */
export function useBrowser() {
  let browser: Browser;
  let site: FixtureServer;

  beforeAll(async () => {
    [browser, site] = await Promise.all([chromium.launch(), startFixtureServer()]);
  });

  afterAll(async () => {
    await Promise.all([browser?.close(), site?.close()]);
  });

  return {
    origin: () => site.origin,
    async newContext(): Promise<BrowserContext> {
      const context = await browser.newContext();
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin === site.origin) return route.continue();
        if (GA_HOST.test(url.hostname)) return route.fulfill({ status: 204 });
        return route.abort('blockedbyclient');
      });
      return context;
    },
  };
}
