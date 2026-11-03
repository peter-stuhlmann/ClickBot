import { describe, expect, it } from 'vitest';
import { engineStarts, useBrowser } from '../test/browser';
import { createRunWatchRegistry } from './run-watch';
import { streamRun, type WatchMessage } from './watch-stream';

// Starting a browser context takes a while under the load of the whole test run.
const SLOW = { timeout: 10_000 };

describe.skipIf(!(await engineStarts('firefox')))(
  'streamRun – Firefox, which has no screencast',
  () => {
    const browser = useBrowser('firefox');

    it('sends screenshots of the page the run works in, also of a new tab', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/kontakt.html`);
      const runs = createRunWatchRegistry();
      const tap = runs.start('run-1', { engine: 'firefox', secrets: [], total: 1 });
      tap.page(page);

      const messages: WatchMessage[] = [];
      const stop = streamRun(await runs.started('run-1'), (message) => messages.push(message));
      await expect
        .poll(() => messages.filter((m) => m.type === 'frame').length, SLOW)
        .toBeGreaterThan(1);

      const tab = await context.newPage();
      await tab.goto(`${browser.origin()}/danke.html`);
      tap.page(tab);
      const before = messages.length;
      await expect
        .poll(() => messages.slice(before).some((m) => m.type === 'frame'), SLOW)
        .toBe(true);

      await stop();
      await context.close();
    });
  },
);

describe('streamRun – Chromium, whose screencast only paints changes', () => {
  const browser = useBrowser();

  it('shows a page that stands still when the watcher comes late, not a blank picture', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${browser.origin()}/kontakt.html`);
    // Painted and quiet: nothing will change before the watcher arrives.
    await page.evaluate(
      '() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    const runs = createRunWatchRegistry();
    runs.start('run-1', { engine: 'chromium', secrets: [], total: 1 }).page(page);

    const messages: WatchMessage[] = [];
    const stop = streamRun(await runs.started('run-1'), (message) => messages.push(message));
    await expect
      .poll(() => messages.some((m) => m.type === 'frame'), { timeout: 5_000 })
      .toBe(true);

    await stop();
    await context.close();
  });
});
