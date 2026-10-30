import { chromium, firefox, webkit, type Browser } from 'playwright';

export type EngineName = 'chromium' | 'firefox' | 'webkit';

/**
 * Starts the browser of an engine, the same way for the worker and its tests. Chromium runs as
 * the full browser in its new headless mode, not as the slimmer headless shell: only it shows
 * PDFs, e.g. a CV a page opens in a new tab (the shell leaves such a tab empty).
 */
export function launchEngine(engine: EngineName): Promise<Browser> {
  if (engine === 'chromium') return chromium.launch({ channel: 'chromium' });
  return (engine === 'firefox' ? firefox : webkit).launch();
}
