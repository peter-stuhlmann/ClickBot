import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { describeQuery, queryElements, QUERY_LIMIT } from './query';

describe('describeQuery', () => {
  it('tells a missing attribute from an empty one and from a value', () => {
    const text = describeQuery('img', {
      total: 3,
      elements: [
        { tag: 'img', attributes: { alt: null, src: '/a.jpg' }, text: '', visible: true },
        { tag: 'img', attributes: { alt: '', src: '/b.jpg' }, text: '', visible: true },
        { tag: 'img', attributes: { alt: 'Essecke', src: '/c.jpg' }, text: '', visible: false },
      ],
    });
    expect(text.split('\n')).toEqual([
      '3 Treffer für „img“:',
      '1. <img> alt fehlt · src=„/a.jpg“',
      '2. <img> alt leer · src=„/b.jpg“',
      '3. <img> alt=„Essecke“ · src=„/c.jpg“ · versteckt',
    ]);
  });

  it('says how many matched when only the first ones are shown, and when none matched', () => {
    const element = { tag: 'a', attributes: {}, text: 'Link', visible: true };
    expect(describeQuery('a', { total: 90, elements: [element] }).split('\n')[0]).toBe(
      '90 Treffer für „a“, die ersten 1:',
    );
    expect(describeQuery('h9', { total: 0, elements: [] })).toBe('Keine Treffer für „h9“.');
  });

  it('shortens long values and texts', () => {
    const text = describeQuery('a', {
      total: 1,
      elements: [
        {
          tag: 'a',
          attributes: { href: `/${'x'.repeat(300)}` },
          text: 'T'.repeat(200),
          visible: true,
        },
      ],
    });
    expect(text.length).toBeLessThan(300);
    expect(text).toContain('…');
  });
});

describe('queryElements', () => {
  const browser = useBrowser();

  async function query(selector: string, attributes?: string[]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/alt-texte.html`);
      return await queryElements(page, selector, attributes);
    } finally {
      await context.close();
    }
  }

  it('lists every image with its alt attribute: missing, empty and given are told apart', async () => {
    const text = await query('img');
    expect(text).toContain('7 Treffer für „img“:');
    expect(text).toContain('<img> alt fehlt · src=„/bilder/ohne.jpg“');
    expect(text).toContain('<img> alt leer · src=„/bilder/dekor.jpg“');
    expect(text).toContain('alt=„Essecke.jpg“ · src=„/bilder/Essecke.jpg“');
    // A title is not an alt text: the alt attribute is missing, the title is shown apart.
    expect(text).toMatch(/alt fehlt · src=„\/bilder\/bad\.jpg“ · title=„Bad“/);
    expect(text).toMatch(/alt=„Versteckt“.* · versteckt/);
  });

  it('also finds images inside iframes', async () => {
    expect(await query('img')).toContain('alt=„Bild im Frame“');
  });

  it('shows the attributes asked for, instead of the usual ones', async () => {
    const text = await query('img', ['alt']);
    expect(text).toContain('<img> alt fehlt');
    expect(text).not.toContain('src=');
  });

  it('uses a few general attributes and the text for other elements', async () => {
    const text = await query('h1, [role="img"]');
    expect(text).toContain(
      '<h1> id fehlt · class fehlt · aria-label fehlt · role fehlt · Text „Unterkunft“',
    );
    expect(text).toContain(
      '<div> id fehlt · class fehlt · aria-label=„Hintergrundbild“ · role=„img“',
    );
  });

  it('says so when nothing matches, and reports an invalid selector as text', async () => {
    expect(await query('video')).toBe('Keine Treffer für „video“.');
    expect(await query('img[')).toBe('Ungültiger CSS-Selektor: „img[“.');
  });

  it('shows at most the first matches, but counts all', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/alt-texte.html`);
      await page.evaluate(() => {
        for (let i = 0; i < 100; i += 1) document.body.append(document.createElement('hr'));
      });
      const lines = (await queryElements(page, 'hr', undefined)).split('\n');
      expect(lines[0]).toBe(`100 Treffer für „hr“, die ersten ${QUERY_LIMIT}:`);
      expect(lines).toHaveLength(QUERY_LIMIT + 1);
    } finally {
      await context.close();
    }
  });
});
