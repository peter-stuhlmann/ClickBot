import type { Frame, Page } from 'playwright';

const SNAPSHOT_TIMEOUT_MS = 3_000;
/** Enough for a large page; the rest would only cost the model tokens. */
const MAX_SNAPSHOT_CHARS = 30_000;

async function frameSnapshot(frame: Frame): Promise<string> {
  return frame
    .locator('body')
    .ariaSnapshot({ timeout: SNAPSHOT_TIMEOUT_MS })
    .catch(() => '');
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
