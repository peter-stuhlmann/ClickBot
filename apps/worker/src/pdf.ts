import type { Page } from 'playwright';
import { waitUntil } from './targets';

/** Chrome's built-in PDF viewer, a frame inside a page that shows a PDF. */
export const PDF_VIEWER = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/';

/** The PDF viewer's load state ('loading', 'success', 'failed'), or undefined without one. */
async function viewerState(page: Page): Promise<string | undefined> {
  const viewer = page.frames().find((frame) => frame.url().startsWith(PDF_VIEWER));
  return viewer
    ?.evaluate(
      () =>
        (document.querySelector('pdf-viewer') as unknown as { loadState_?: string } | null)
          ?.loadState_,
    )
    .catch(() => undefined);
}

/**
 * Waits until Chrome's PDF viewer has drawn the PDF in `page`; returns at once for other pages.
 * The viewer draws a moment after the page has loaded, and a photo before that is empty. It
 * reads the viewer's load state, an internal of Chrome, so it only ever waits, never fails, and
 * never longer than `timeoutMs`, also on a page that does not answer.
 */
export async function waitForPdf(page: Page, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const drawn = (async () => {
    const isPdf = await page
      .evaluate(() => document.contentType === 'application/pdf')
      .catch(() => false);
    if (!isPdf) return;
    await waitUntil(async () => {
      const state = await viewerState(page);
      return state !== undefined && state !== 'loading';
    }, timeoutMs);
  })();
  await Promise.race([drawn, timeUp]);
  clearTimeout(timer);
}
