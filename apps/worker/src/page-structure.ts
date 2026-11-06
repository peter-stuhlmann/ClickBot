import type { BrowserContext, Frame, Page } from 'playwright';

const SNAPSHOT_TIMEOUT_MS = 3_000;
/** Enough for a large page; the rest would only cost the model tokens. */
const MAX_SNAPSHOT_CHARS = 30_000;

async function frameSnapshot(frame: Frame): Promise<string> {
  return frame
    .locator('body')
    .ariaSnapshot({ timeout: SNAPSHOT_TIMEOUT_MS })
    .catch(() => '');
}

/** Network that has not moved for 500 ms; pages with polling or trackers never get there. */
const NETWORK_IDLE_MAX_MS = 3_000;
/** The page counts as at rest after this long without changes to its DOM. */
const QUIET_MS = 1_000;
const DOM_QUIET_MAX_MS = 4_000;

/** Where a page notes when its DOM changed last (ms since 1970), for the wait below. */
const CHANGE_MARK = '__clickBotChange';

// Runs in every document before its own scripts. A string, not a function: tsx would wrap named
// functions in __name(), which the page lacks.
const TRACK_SCRIPT = `(() => {
  if (typeof window.${CHANGE_MARK} === 'number') return;
  window.${CHANGE_MARK} = Date.now();
  const mark = () => { window.${CHANGE_MARK} = Date.now(); };
  new MutationObserver(mark).observe(document, {
    subtree: true, childList: true, attributes: true, characterData: true,
  });
  window.addEventListener('load', mark);
})();`;

/**
 * Makes every page of the context note when its DOM changed last, from its first moment on. The
 * wait for a settling page then costs nothing when the page has long been quiet (the AI needs
 * seconds to answer), and waits only when it changed just now, e.g. after a click.
 */
export async function trackPageActivity(context: BrowserContext): Promise<void> {
  await context.addInitScript({ content: TRACK_SCRIPT });
}

// Rest: no change to the DOM for `quietMs` (by the mark of the page; a page that was not tracked
// starts counting now), and no loading indicator (aria-busy, progressbar).
const AT_REST_SCRIPT = `async ({ quietMs, maxMs }) => {
  const busy = () => document.querySelector('[aria-busy="true"], [role="progressbar"]') !== null;
  if (typeof window.${CHANGE_MARK} !== 'number') {
    window.${CHANGE_MARK} = Date.now();
    new MutationObserver(() => { window.${CHANGE_MARK} = Date.now(); }).observe(document, {
      subtree: true, childList: true, attributes: true, characterData: true,
    });
  }
  const end = Date.now() + maxMs;
  while (Date.now() < end && (Date.now() - window.${CHANGE_MARK} < quietMs || busy())) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}`;

/**
 * Waits until a page that renders its content with JavaScript (an app that loads its data after
 * the page is open) shows it: the network is quiet and the DOM stopped changing, and no loading
 * indicator is left. Bounded: a page that never rests (polling, an endless ticker) is taken as it
 * is after a few seconds. Never throws, so the AI sees the page either way.
 */
export async function waitForPageToSettle(page: Page): Promise<void> {
  await page
    .waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MAX_MS })
    .catch(() => undefined);
  // A click may have started a navigation that destroys the context once; one more try.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const done = await page
      // A string is only evaluated, not called with an argument: call it here.
      .evaluate(
        `(${AT_REST_SCRIPT})(${JSON.stringify({ quietMs: QUIET_MS, maxMs: DOM_QUIET_MAX_MS })})`,
      )
      .then(() => true)
      .catch(() => false);
    if (done) return;
    await page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
  }
}

/**
 * The accessibility tree of the page and its iframes (where cookie banners often live), as an AI
 * model reads it for the actions of an AI step.
 */
export async function readStructure(page: Page): Promise<string> {
  const parts: string[] = [];
  for (const frame of page.frames()) {
    const snapshot = await frameSnapshot(frame);
    if (!snapshot.trim()) continue;
    parts.push(frame === page.mainFrame() ? snapshot : `# iframe ${frame.url()}\n${snapshot}`);
  }
  return parts.join('\n\n').slice(0, MAX_SNAPSHOT_CHARS);
}
