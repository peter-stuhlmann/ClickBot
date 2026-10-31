import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { openPage } from './navigate';

const browser = useBrowser();

async function withPage<T>(use: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext();
  try {
    return await use(await context.newPage());
  } finally {
    await context.close();
  }
}

describe('openPage', () => {
  it('is done once the content is there, even if an ad never loads', async () => {
    await withPage(async (page) => {
      // Before, this failed after the 3 s; now it is done once the content is there.
      const response = await openPage(page, `${browser.origin()}/werbung.html`, 3_000);
      expect(response?.status()).toBe(200);
      expect(await page.title()).toBe('Artikel mit Werbung');
    });
  });

  it('waits a moment for the load event, e.g. for an image that comes late', async () => {
    await withPage(async (page) => {
      await openPage(page, `${browser.origin()}/bilder.html`, 5_000);
      expect(await page.evaluate(() => document.readyState)).toBe('complete');
    });
  });

  it('gives up on a page that does not answer at all', async () => {
    await withPage(async (page) => {
      await expect(openPage(page, `${browser.origin()}/haengt`, 300)).rejects.toThrow(/Timeout/);
    });
  });
});
