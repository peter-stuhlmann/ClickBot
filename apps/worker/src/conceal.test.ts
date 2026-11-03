import { PNG } from 'pngjs';
import type { BrowserContext, Frame, Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { engineStarts, useBrowser } from '../test/browser';
import { concealSecrets, exposesSecret } from './conceal';

const SECRET = 's3cr3t-Wert';

type Box = { x: number; y: number; width: number; height: number };

/** Where `text` stands inside the element, in coordinates of the window of its frame. */
function textBox(frame: Frame | Page, selector: string, text: string): Promise<Box> {
  return frame.evaluate(
    ([selector, text]) => {
      const element = document.querySelector(selector);
      const walker = document.createTreeWalker(element ?? document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = (node as Text).data.indexOf(text);
        if (at === -1) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + text.length);
        const { x, y, width, height } = range.getBoundingClientRect();
        return { x, y, width, height };
      }
      throw new Error(`${text} fehlt in ${selector}.`);
    },
    [selector, text] as const,
  );
}

/** The darkest pixel of the window within `box`: 0 is black text, 255 white. */
async function darkest(page: Page, box: Box): Promise<number> {
  const png = PNG.sync.read(await page.screenshot());
  let min = 255;
  for (let y = Math.floor(box.y); y < Math.ceil(box.y + box.height); y++) {
    for (let x = Math.floor(box.x); x < Math.ceil(box.x + box.width); x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i] ?? 255;
      const g = png.data[i + 1] ?? 255;
      const b = png.data[i + 2] ?? 255;
      min = Math.min(min, Math.round(0.299 * r + 0.587 * g + 0.114 * b));
    }
  }
  return min;
}

/** Number of blurred boxes the page shows now, read in the same task. */
const boxes = () => document.querySelector('click-bot-conceal')?.shadowRoot?.childElementCount ?? 0;

// Black text is 0; blurred and tinted it stays far from that.
const READABLE = 40;
const UNREADABLE = 110;

const ENGINES = ['chromium', 'firefox', 'webkit'] as const;
const starts = Object.fromEntries(
  await Promise.all(ENGINES.map(async (engine) => [engine, await engineStarts(engine)] as const)),
) as Record<(typeof ENGINES)[number], boolean>;

for (const engine of ENGINES) {
  (starts[engine] ? describe : describe.skip)(`concealSecrets in ${engine}`, () => {
    const browser = useBrowser(engine);

    async function open(
      path: string,
      secrets = [SECRET],
    ): Promise<{ page: Page; context: BrowserContext }> {
      const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      await concealSecrets(context, secrets);
      const page = await context.newPage();
      await page.goto(`${browser.origin()}${path}`);
      return { page, context };
    }

    it('blurs a secret in the text so it cannot be read, and leaves the rest of the page readable', async () => {
      const { page, context } = await open('/geheim.html');
      expect(await darkest(page, await textBox(page, '#schluessel', SECRET))).toBeGreaterThan(
        UNREADABLE,
      );
      expect(await darkest(page, await textBox(page, 'p', 'Ihr Schlüssel'))).toBeLessThan(READABLE);
      expect(await exposesSecret(page, [SECRET])).toBe(false);
      await context.close();
    });

    it('shows the secret without concealment, the check of the test itself', async () => {
      const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/geheim.html`);
      expect(await darkest(page, await textBox(page, '#schluessel', SECRET))).toBeLessThan(
        READABLE,
      );
      // Without the script in the page the plain look decides: the secret is there.
      expect(await exposesSecret(page, [SECRET])).toBe(true);
      expect(await exposesSecret(page, [])).toBe(false);
      await context.close();
    });

    it('blurs a field the moment a secret is filled in, before the page is painted again', async () => {
      const { page, context } = await open('/geheim.html');
      // The secret in the text and the one far down the page.
      expect(await page.evaluate(boxes)).toBe(2);

      const counts = await page.evaluate((secret) => {
        const field = document.querySelector<HTMLInputElement>('#notiz');
        if (!field) throw new Error('Feld fehlt.');
        const type = (value: string) => {
          field.value = value;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          return document.querySelector('click-bot-conceal')?.shadowRoot?.childElementCount ?? 0;
        };
        return [type(secret), type('Erika')];
      }, SECRET);
      expect(counts).toEqual([3, 2]);
      await context.close();
    });

    it('blurs the field with the focus while a secret is typed into it, letter by letter', async () => {
      const { page, context } = await open('/geheim.html');
      const field = page.locator('#notiz');
      await field.pressSequentially('s3c');
      expect(await page.evaluate(boxes)).toBe(3);
      expect(await darkest(page, (await field.boundingBox()) as Box)).toBeGreaterThan(UNREADABLE);

      // Other text, or the field without the focus, is no secret.
      await field.fill('Hallo');
      expect(await page.evaluate(boxes)).toBe(2);
      await context.close();
    });

    it('leaves password fields as they are: dots show that something is in them, not what', async () => {
      const { page, context } = await open('/geheim.html');
      const field = page.locator('#kennwort');
      await field.fill(SECRET);
      expect(await page.evaluate(boxes)).toBe(2);
      expect(await darkest(page, (await field.boundingBox()) as Box)).toBeLessThan(READABLE);
      expect(await exposesSecret(page, [SECRET])).toBe(false);

      // Shown as text ("Passwort anzeigen"), it is a field with a secret like any other.
      await field.evaluate((input) => ((input as HTMLInputElement).type = 'text'));
      expect(await page.evaluate(boxes)).toBe(3);
      await context.close();
    });

    it('blurs a secret that appears later, before the page is painted again', async () => {
      const { page, context } = await open('/geheim.html');
      const count = await page.evaluate(async (secret) => {
        const target = document.querySelector('#nachgeladen');
        if (target) target.textContent = `Neu: ${secret}`;
        // Mutation observers run in the microtasks after the change, before the next frame.
        await Promise.resolve();
        return document.querySelector('click-bot-conceal')?.shadowRoot?.childElementCount ?? 0;
      }, SECRET);
      expect(count).toBe(3);
      await context.close();
    });

    it('follows the page when it scrolls', async () => {
      const { page, context } = await open('/geheim.html');
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
      );
      await page.evaluate(() => new Promise(requestAnimationFrame));
      expect(await darkest(page, await textBox(page, '#unten', SECRET))).toBeGreaterThan(
        UNREADABLE,
      );
      expect(await darkest(page, await textBox(page, '#unten', 'Ganz unten'))).toBeLessThan(
        READABLE,
      );
      await context.close();
    });

    it('blurs a secret in a modal dialog, which is drawn above everything else', async () => {
      const { page, context } = await open('/geheim.html');
      await page.evaluate(() => document.querySelector<HTMLDialogElement>('#dialog')?.showModal());
      await page.evaluate(() => new Promise(requestAnimationFrame));
      expect(await darkest(page, await textBox(page, '#im-dialog', SECRET))).toBeGreaterThan(
        UNREADABLE,
      );
      expect(await darkest(page, await textBox(page, '#im-dialog', 'Im Dialog'))).toBeLessThan(
        READABLE,
      );
      await context.close();
    });

    it('blurs a secret inside an iframe', async () => {
      const { page, context } = await open('/geheim-rahmen.html');
      const frame = page.frame({ url: /geheim\.html$/ });
      if (!frame) throw new Error('Rahmen fehlt.');
      await frame.waitForLoadState();
      await frame.evaluate(() => new Promise(requestAnimationFrame));
      const inFrame = await textBox(frame, '#schluessel', SECRET);
      const offset = await page.locator('iframe').boundingBox();
      if (!offset) throw new Error('Rahmen ohne Größe.');
      const box = { ...inFrame, x: inFrame.x + offset.x, y: inFrame.y + offset.y };
      expect(await darkest(page, box)).toBeGreaterThan(UNREADABLE);
      expect(await exposesSecret(page, [SECRET])).toBe(false);
      await context.close();
    });

    it('counts a secret it cannot cover as shown: split over two elements', async () => {
      const { page, context } = await open('/geheim.html');
      await page.evaluate(() => document.querySelector('#getrennt')?.removeAttribute('hidden'));
      expect(await exposesSecret(page, [SECRET])).toBe(true);
      await context.close();
    });
  });
}
