import type { BrowserContext } from 'playwright';
import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { startRecorder, type RecordedStep } from './recorder';
import { locate } from './targets';

const browser = useBrowser();

/** Opens `path` with the recorder running and returns the page and the steps so far. */
async function record(path: string) {
  const context = await browser.newContext();
  const steps: RecordedStep[] = [];
  const recorder = await startRecorder(context, (step) => steps.push(step));
  const page = await context.newPage();
  await page.goto(`${browser.origin()}${path}`);
  // Each action is checked on the worker; wait until it arrived instead of sleeping.
  const settled = async (count: number) => {
    await expect.poll(() => steps.length).toBe(count);
    return steps.slice();
  };
  return { context, page, steps, settled, recorder };
}

describe('startRecorder', () => {
  it('turns typing and clicking into fill and click steps, found the way the bot finds them', async () => {
    const { context, page, settled } = await record('/aufnahme.html');
    await page.getByLabel('Benutzername').click();
    await page.keyboard.insertText('lena');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    expect(await settled(2)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Benutzername' }, value: 'lena' },
      { type: 'click', target: { by: 'role', role: 'button', name: 'Anmelden' } },
    ]);
    await context.close();
  });

  it('never records what is typed into a password field', async () => {
    const { context, page, settled } = await record('/aufnahme.html');
    await page.getByLabel('Passwort').click();
    await page.keyboard.insertText('Geheim-123');
    await page.keyboard.press('Tab');

    expect(await settled(2)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Passwort' }, value: '{{secret.passwort}}' },
      // Tab moves on to the next field: a key step of its own.
      { type: 'press', key: 'Tab', target: { by: 'label', label: 'Passwort' } },
    ]);
    expect(JSON.stringify(await settled(2))).not.toContain('Geheim');
    await context.close();
  });

  it('records a choice in a select with the visible option text', async () => {
    const { context, page, settled } = await record('/aufnahme.html');
    await page.getByLabel('Bereich').selectOption('shop');

    expect(await settled(1)).toEqual([
      { type: 'select', target: { by: 'label', label: 'Bereich' }, option: 'Shop' },
    ]);
    await context.close();
  });

  it('records a checkbox clicked through its label once, as a click on the checkbox', async () => {
    const { context, page, settled } = await record('/aufnahme.html');
    await page.getByText('Angemeldet bleiben').click();

    expect(await settled(1)).toEqual([
      { type: 'click', target: { by: 'role', role: 'checkbox', name: 'Angemeldet bleiben' } },
    ]);
    await expect.poll(() => page.getByRole('checkbox').isChecked()).toBe(true);
    await context.close();
  });

  it('falls back to the id when the name is not unique', async () => {
    const { context, page, settled } = await record('/aufnahme.html');
    await page.locator('#more-events').click();

    expect(await settled(1)).toEqual([
      { type: 'click', target: { by: 'css', selector: '#more-events' } },
    ]);
    await context.close();
  });

  it('records submitting with Enter as a click on the submit button', async () => {
    const { context, page, settled } = await record('/aufnahme.html');
    await page.getByLabel('Benutzername').click();
    await page.keyboard.insertText('lena');
    await page.keyboard.press('Enter');

    expect(await settled(2)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Benutzername' }, value: 'lena' },
      { type: 'click', target: { by: 'role', role: 'button', name: 'Anmelden' } },
    ]);
    await context.close();
  });

  it('records clicks inside iframes, e.g. a consent banner', async () => {
    const { context, page, settled } = await record('/consent-iframe.html');
    await page
      .frameLocator('#consent')
      .getByRole('button', { name: 'Einwilligen und weiter' })
      .click();

    expect(await settled(1)).toEqual([
      { type: 'click', target: { by: 'role', role: 'button', name: 'Einwilligen und weiter' } },
    ]);
    await context.close();
  });

  it('records the button of a banner that removes itself on the click', async () => {
    const { context, page, settled } = await record('/kontakt.html');
    await page.getByRole('button', { name: 'Alle akzeptieren' }).click();

    expect(await settled(1)).toEqual([
      { type: 'click', target: { by: 'role', role: 'button', name: 'Alle akzeptieren' } },
    ]);
    await context.close();
  });

  it('turns a click into a check while checking, without clicking the page', async () => {
    const { context, page, settled, recorder } = await record('/aufnahme.html');
    await recorder.setMode('assert');
    await page.getByRole('link', { name: 'Kontakt' }).click();

    expect(await settled(1)).toEqual([
      {
        type: 'assert',
        assertion: {
          kind: 'elementVisible',
          target: { by: 'role', role: 'link', name: 'Kontakt' },
        },
      },
    ]);
    expect(page.url()).toMatch(/\/aufnahme\.html$/);
    await context.close();
  });

  it('turns a click into waiting for that element, without clicking the page', async () => {
    const { context, page, settled, recorder } = await record('/aufnahme.html');
    await recorder.setMode('wait');
    await page.getByRole('link', { name: 'Kontakt' }).click();

    expect(await settled(1)).toEqual([
      {
        type: 'wait',
        until: { kind: 'element', target: { by: 'role', role: 'link', name: 'Kontakt' } },
      },
    ]);
    expect(page.url()).toMatch(/\/aufnahme\.html$/);
    expect(recorder.mode()).toBe('record');
    await context.close();
  });
});

describe('startRecorder – links that leave the page', () => {
  /** How many elements the recorded target finds on a fresh copy of the page. */
  async function matchesOnFreshPage(context: BrowserContext, step: RecordedStep) {
    const fresh = await context.newPage();
    await fresh.goto(`${browser.origin()}/links.html`);
    if (step.type !== 'click') throw new Error('expected a click');
    return locate(fresh, step.target).count();
  }

  it('names a card link like the bot does: with the alt text of its image', async () => {
    const { context, page, settled } = await record('/links.html');
    await page.getByRole('link', { name: /Katalanisch lernen/ }).click();

    const steps = await settled(1);
    expect(steps).toEqual([
      {
        type: 'click',
        target: {
          by: 'role',
          role: 'link',
          name: 'Katalanisch lernen mit Sprachkursen | Beispiel Katalanisch lernen',
        },
      },
    ]);
    await expect.poll(() => page.url()).toMatch(/\/danke\.html\?kurs=katalanisch$/);
    expect(await matchesOnFreshPage(context, steps[0] as RecordedStep)).toBe(1);
    await context.close();
  });

  it('checks the target before the link leaves the page, so equal links get a unique one', async () => {
    const { context, page, settled } = await record('/links.html');
    await page.locator('#info-2').click();

    expect(await settled(1)).toEqual([
      { type: 'click', target: { by: 'css', selector: '#info-2' } },
    ]);
    await expect.poll(() => page.url()).toMatch(/\/danke\.html\?kurs=2$/);
    await context.close();
  });

  it('skips hidden text and keeps generated content in the name, as the bot sees it', async () => {
    const { context, page, settled } = await record('/links.html');
    await page.getByRole('link', { name: /Weiter$/ }).click();

    const steps = await settled(1);
    expect(steps[0]).toEqual({
      type: 'click',
      target: { by: 'role', role: 'link', name: '→ Weiter' },
    });
    await expect.poll(() => page.url()).toMatch(/\/danke\.html\?kurs=weiter$/);
    expect(await matchesOnFreshPage(context, steps[0] as RecordedStep)).toBe(1);
    await context.close();
  });

  it('lets a link that only scrolls the page do so', async () => {
    const { context, page, settled } = await record('/links.html');
    await page.getByRole('link', { name: 'Nach unten' }).click();

    expect(await settled(1)).toEqual([
      { type: 'click', target: { by: 'role', role: 'link', name: 'Nach unten' } },
    ]);
    await expect.poll(() => page.url()).toMatch(/\/links\.html#unten$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await context.close();
  });
});

describe('startRecorder – keys', () => {
  it('records typing in a field as one fill step, and the key that leaves it', async () => {
    const { context, page, settled } = await record('/lang.html');
    await page.getByLabel('Suche').click();
    await page.keyboard.type('Schuhe');
    await page.keyboard.press('Tab');

    expect(await settled(2)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Suche' }, value: 'Schuhe' },
      { type: 'press', key: 'Tab', target: { by: 'label', label: 'Suche' } },
    ]);
    await context.close();
  });

  it('records Escape on the page, and shortcuts with their modifiers', async () => {
    const { context, page, settled } = await record('/lang.html');
    await page.keyboard.press('Escape');
    await page.getByLabel('Suche').focus();
    await page.keyboard.press('Control+Shift+K');

    expect(await settled(2)).toEqual([
      { type: 'press', key: 'Escape' },
      { type: 'press', key: 'Control+Shift+K', target: { by: 'label', label: 'Suche' } },
    ]);
    await context.close();
  });

  it('records Enter in a field without a form as a key, and in a form as the submit click', async () => {
    const { context, page, settled } = await record('/lang.html');
    await page.getByLabel('Suche').fill('Schuhe');
    await page.getByLabel('Suche').press('Enter');

    expect(await settled(2)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Suche' }, value: 'Schuhe' },
      { type: 'press', key: 'Enter', target: { by: 'label', label: 'Suche' } },
    ]);
    await context.close();
  });

  it('records no key for keys that only scroll the page', async () => {
    const { context, page, steps, settled } = await record('/lang.html');
    await page.keyboard.press('PageDown');
    // The page scrolled: that is the step, not the key.
    expect((await settled(1)).map((step) => step.type)).toEqual(['scroll']);
    expect(steps.some((step) => step.type === 'press')).toBe(false);
    await context.close();
  });
});

describe('startRecorder – scrolling', () => {
  it('records one scroll step where the page comes to rest', async () => {
    const { context, page, settled } = await record('/lang.html');
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 700);
    await page.mouse.wheel(0, 500);

    const [step] = await settled(1);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);
    expect(step).toEqual({
      type: 'scroll',
      to: { kind: 'position', y: await page.evaluate(() => Math.round(window.scrollY)), x: 0 },
    });
    await context.close();
  });

  it('records sideways scrolling on a page wider than the window', async () => {
    const { context, page, settled } = await record('/lang.html');
    await page.mouse.move(200, 200);
    await page.mouse.wheel(400, 0);

    const [step] = await settled(1);
    expect(step).toEqual({ type: 'scroll', to: { kind: 'position', y: 0, x: 400 } });
    await context.close();
  });

  it('leaves out the position from the left when the page fits the window sideways', async () => {
    const { context, page, settled } = await record('/lang.html');
    await page.setViewportSize({ width: 3200, height: 800 });
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 700);

    const [step] = await settled(1);
    expect(step).toEqual({ type: 'scroll', to: { kind: 'position', y: expect.any(Number) } });
    await context.close();
  });
});

describe('startRecorder – steps added in between', () => {
  it('keeps them in the order of the actions, e.g. a photo right after a click', async () => {
    const { context, page, settled, recorder } = await record('/aufnahme.html');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await recorder.insert({ type: 'screenshot' });

    expect(await settled(2)).toEqual([
      { type: 'click', target: { by: 'role', role: 'button', name: 'Anmelden' } },
      { type: 'screenshot' },
    ]);
    await context.close();
  });
});
