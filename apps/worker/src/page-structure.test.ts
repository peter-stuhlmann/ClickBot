import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { readStructure, trackPageActivity, waitForPageToSettle } from './page-structure';

const browser = useBrowser();

async function structureOf(path: string, ready?: (page: Page) => Promise<unknown>) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${browser.origin()}${path}`);
    await ready?.(page);
    return await readStructure(page);
  } finally {
    await context.close();
  }
}

describe('readStructure', () => {
  it('reads the accessibility tree of a page', async () => {
    const structure = await structureOf('/kontakt.html');
    expect(structure).toContain('button "Alle akzeptieren"');
    expect(structure).toContain('textbox "Name"');
  });

  it('includes iframes, where cookie banners often live', async () => {
    // The banner comes a moment later, as real ones do.
    const structure = await structureOf('/consent-iframe.html', (page) =>
      page.frameLocator('iframe').getByRole('button', { name: 'Einwilligen und weiter' }).waitFor(),
    );
    expect(structure).toMatch(/# iframe .*consent-frame\.html/);
    expect(structure).toContain('button "Einwilligen und weiter"');
  });
});

describe('waiting for a page to settle', () => {
  const MARK = '__clickBotChange';

  async function tracked(path: string) {
    const context = await browser.newContext();
    await trackPageActivity(context);
    const page = await context.newPage();
    await page.goto(`${browser.origin()}${path}`);
    return { page, close: () => context.close() };
  }
  const elapsed = async (page: Page) => {
    const started = Date.now();
    await waitForPageToSettle(page);
    return Date.now() - started;
  };

  it('notes in every document when its DOM changed last, from the first moment on', async () => {
    const { page, close } = await tracked('/kontakt.html');
    try {
      expect(await page.evaluate(`typeof window.${MARK}`)).toBe('number');
      await page.evaluate(`window.${MARK} = 0`);
      await page.evaluate(() => document.body.append(document.createElement('hr')));
      await expect.poll(() => page.evaluate(`window.${MARK}`)).toBeGreaterThan(0);
      // A new document gets its own mark.
      await page.goto(`${browser.origin()}/danke.html`);
      expect(await page.evaluate(`typeof window.${MARK}`)).toBe('number');
    } finally {
      await close();
    }
  });

  it('costs next to nothing for a page that has been quiet for a while', async () => {
    const { page, close } = await tracked('/kontakt.html');
    try {
      // The page has been quiet for five seconds (the AI took its time to answer).
      await page.evaluate(`window.${MARK} = Date.now() - 5000`);
      // The first look also lets the network settle; the quiet period itself is skipped.
      await waitForPageToSettle(page);
      await page.evaluate(`window.${MARK} = Date.now() - 5000`);
      expect(await elapsed(page)).toBeLessThan(400);
    } finally {
      await close();
    }
  });

  it('waits out the quiet period for a page that changed just now, e.g. after a click', async () => {
    const { page, close } = await tracked('/kontakt.html');
    try {
      await waitForPageToSettle(page);
      await page.evaluate(`window.${MARK} = Date.now()`);
      expect(await elapsed(page)).toBeGreaterThanOrEqual(900);
    } finally {
      await close();
    }
  });

  it('still waits for a page that was not tracked, counting from now', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/kontakt.html`);
      // The first look has no history of the page: it counts the quiet period from now ...
      expect(await elapsed(page)).toBeGreaterThanOrEqual(900);
      // ... and has set up the mark, so the second is free.
      expect(await elapsed(page)).toBeLessThan(400);
    } finally {
      await context.close();
    }
  });
});
