import type { Browser, BrowserContext, BrowserContextOptions } from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import { launchEngine, type EngineName } from '../src/engines';
import { startFixtureServer, type FixtureServer } from './fixture-server';

const GA_HOST = /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/;

/**
 * Lets a context reach only the fixture site at `origin` (and Chrome's built-in pages): GA4
 * requests are answered locally with 204, every other outside request is aborted.
 */
export async function guardContext(
  context: BrowserContext,
  origin: string,
): Promise<BrowserContext> {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    // Chrome's own pages, e.g. its PDF viewer and its resources: they never leave the browser.
    if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:') return route.continue();
    if (GA_HOST.test(url.hostname)) return route.fulfill({ status: 204 });
    return route.abort('blockedbyclient');
  });
  return context;
}

/**
 * Starts a browser (Chromium unless said otherwise) and the fixture site once per test file or
 * describe block. Contexts created through
 * `newContext` can only reach the fixture site; GA4 requests are answered locally with 204,
 * every other outside request is aborted, so no test ever touches the internet.
 */
export function useBrowser(engine: EngineName = 'chromium') {
  let browser: Browser;
  let site: FixtureServer;

  beforeAll(async () => {
    [browser, site] = await Promise.all([launchEngine(engine), startFixtureServer()]);
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
