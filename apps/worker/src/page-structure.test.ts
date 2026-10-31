import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { readStructure } from './page-structure';

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
