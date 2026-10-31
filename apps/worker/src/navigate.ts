import type { Page, Response } from 'playwright';

/** How long an open page may still load images, ads and trackers before the flow goes on. */
const LOAD_GRACE_MS = 5_000;

/**
 * Opens `url` and is done once its content is there (DOMContentLoaded), after waiting a moment
 * for the load event. An ad or tracker that never loads does not fail a page whose content is
 * there; the steps after it wait for their elements anyway. Throws like `page.goto` when the
 * page itself does not come within `timeout`.
 */
export async function openPage(page: Page, url: string, timeout: number): Promise<Response | null> {
  const started = Date.now();
  const response = await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
  const left = Math.min(LOAD_GRACE_MS, timeout - (Date.now() - started));
  if (left > 0) await page.waitForLoadState('load', { timeout: left }).catch(() => undefined);
  return response;
}
