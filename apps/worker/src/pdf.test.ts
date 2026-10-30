import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { PDF_VIEWER, waitForPdf } from './pdf';

const browser = useBrowser();

describe('waitForPdf', () => {
  it('waits until Chrome has drawn a PDF, so a photo shows it', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/lebenslauf.pdf`);
      await waitForPdf(page, 5_000);
      const viewer = page.frames().find((frame) => frame.url().startsWith(PDF_VIEWER));
      expect(
        await viewer?.evaluate(
          () =>
            (document.querySelector('pdf-viewer') as unknown as { loadState_: string }).loadState_,
        ),
      ).toBe('success');
    } finally {
      await context.close();
    }
  });

  it('returns at once for a page that is no PDF', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/danke.html`);
      const started = Date.now();
      await waitForPdf(page, 5_000);
      expect(Date.now() - started).toBeLessThan(1_000);
    } finally {
      await context.close();
    }
  });

  it('gives up quietly when the time is up', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/lebenslauf.pdf`);
      await expect(waitForPdf(page, 0)).resolves.toBeUndefined();
    } finally {
      await context.close();
    }
  });
});
