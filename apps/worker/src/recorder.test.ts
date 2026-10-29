import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { startRecorder, type RecordedStep } from './recorder';

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

    expect(await settled(1)).toEqual([
      { type: 'fill', target: { by: 'label', label: 'Passwort' }, value: '{{secret.passwort}}' },
    ]);
    expect(JSON.stringify(await settled(1))).not.toContain('Geheim');
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

  it('records nothing while only browsing', async () => {
    const { context, page, steps, recorder } = await record('/aufnahme.html');
    await recorder.setMode('browse');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect.poll(() => page.locator('#state').textContent()).toBe('Angemeldet.');
    expect(steps).toEqual([]);
    await context.close();
  });
});
