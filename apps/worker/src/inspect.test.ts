import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { describeColor, inspectTarget } from './inspect';

describe('describeColor', () => {
  it.each([
    ['rgb(200, 0, 0)', 'rgb(200, 0, 0) / #C80000'],
    ['rgb(0 128 0)', 'rgb(0, 128, 0) / #008000'],
    ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.5) / #FFFFFF bei 50 % Deckkraft'],
    ['rgba(255, 255, 255, 1)', 'rgb(255, 255, 255) / #FFFFFF'],
    ['color(srgb 0.78 0 0)', 'rgb(199, 0, 0) / #C70000'],
    ['rgb(0 0 0 / 50%)', 'rgba(0, 0, 0, 0.5) / #000000 bei 50 % Deckkraft'],
  ])('writes %s with its #HEX', (css, expected) => {
    expect(describeColor(css)).toBe(expected);
  });

  it('says transparent for a colour without opacity, and leaves unknown formats as they are', () => {
    expect(describeColor('rgba(0, 0, 0, 0)')).toBe('transparent');
    expect(describeColor('transparent')).toBe('transparent');
    expect(describeColor('oklch(0.6 0.2 30)')).toBe('oklch(0.6 0.2 30)');
  });
});

describe('inspectTarget', () => {
  const browser = useBrowser();

  async function inspect(target: Parameters<typeof inspectTarget>[1]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/farben.html`);
      return await inspectTarget(page, target, 3_000);
    } finally {
      await context.close();
    }
  }

  it('reads text, colour with its #HEX, size, weight and font of a heading', async () => {
    const line = await inspect({ by: 'role', role: 'heading', name: 'Seehaus 7' });
    expect(line).toContain('Text „Seehaus 7“');
    expect(line).toContain('Schriftfarbe rgb(200, 0, 0) / #C80000');
    expect(line).toContain('Schriftgröße 36px');
    expect(line).toContain('Schriftstärke 700');
    expect(line).toContain('Schriftart Arial');
  });

  it('gives the background that is really seen: the parent when the element has none', async () => {
    const line = await inspect({ by: 'text', text: 'Hinweis', exact: false });
    expect(line).toContain('Schriftfarbe rgba(255, 255, 255, 0.5) / #FFFFFF bei 50 % Deckkraft');
    expect(line).toContain('Hintergrund rgb(0, 0, 128) / #000080');
    // The heading has no background of its own either: the page's.
    expect(await inspect({ by: 'css', selector: 'h1' })).toContain(
      'Hintergrund rgb(250, 250, 250) / #FAFAFA',
    );
  });

  it('refuses to guess between several elements, and says when there is none', async () => {
    await expect(inspect({ by: 'css', selector: 'h2' })).rejects.toThrow(/Mehrdeutig/);
    await expect(inspect({ by: 'css', selector: '.gibt-es-nicht' })).rejects.toThrow(
      /Element nicht gefunden/,
    );
  });
});
