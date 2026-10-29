import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
} from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';

const GA_HOST = /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/;

/**
 * Lets a context reach only the fixture site at `origin`: GA4 requests are answered locally with
 * 204, every other outside request is aborted.
 */
export async function guardContext(
  context: BrowserContext,
  origin: string,
): Promise<BrowserContext> {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (GA_HOST.test(url.hostname)) return route.fulfill({ status: 204 });
    return route.abort('blockedbyclient');
  });
  return context;
}

const ENGINES = { chromium, firefox, webkit };

/**
 * Starts a browser (Chromium unless said otherwise) and the fixture site once per test file or
 * describe block. Contexts created through
 * `newContext` can only reach the fixture site; GA4 requests are answered locally with 204,
 * every other outside request is aborted, so no test ever touches the internet.
 */
export function useBrowser(engine: keyof typeof ENGINES = 'chromium') {
  let browser: Browser;
  let site: FixtureServer;

  beforeAll(async () => {
    [browser, site] = await Promise.all([ENGINES[engine].launch(), startFixtureServer()]);
  });

  afterAll(async () => {
    await Promise.all([browser?.close(), site?.close()]);
  });

  return {
    origin: () => site.origin,
    version: () => browser.version(),
    async newContext(options?: BrowserContextOptions): Promise<BrowserContext> {
      return guardContext(await browser.newContext(options), site.origin);
    },
  };
}
