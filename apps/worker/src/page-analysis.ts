import { ALL_MARKINGS_ON, type PageFacts } from '@click-bot/shared';
import type { BrowserContext, Frame } from 'playwright';
import { blockAds } from './ad-blocking';
import { markBotTraffic } from './bot-marking';
import { StepError, refusedCredentials } from './errors';
import { openPage } from './navigate';

const OPEN_TIMEOUT_MS = 20_000;
const SETTLE_TIMEOUT_MS = 5_000;
const SNAPSHOT_TIMEOUT_MS = 3_000;
/** Enough for a large page; the rest would only cost the model tokens. */
const MAX_SNAPSHOT_CHARS = 30_000;
// Analyses are no runs; their GA4 requests carry run number 0 besides the usual markers.
const ANALYSIS_RUN_NR = 0;

const CONSENT_TOOLS: [RegExp, string][] = [
  [/usercentrics/i, 'Usercentrics'],
  [/cookiebot/i, 'Cookiebot'],
  [/cookielaw\.org|onetrust/i, 'OneTrust'],
  [/borlabs/i, 'Borlabs Cookie'],
  [/complianz/i, 'Complianz'],
  [/consentmanager/i, 'consentmanager'],
  [/didomi/i, 'Didomi'],
  [/klaro/i, 'Klaro'],
  [/cookieyes/i, 'CookieYes'],
  [/iubenda/i, 'iubenda'],
];

/** The consent tool a page loads, recognised by the addresses of its scripts and iframes. */
export function detectConsentTool(urls: string[]): string | null {
  for (const [pattern, name] of CONSENT_TOOLS) {
    if (urls.some((url) => pattern.test(url))) return name;
  }
  return null;
}

async function frameSnapshot(frame: Frame): Promise<string> {
  return frame
    .locator('body')
    .ariaSnapshot({ timeout: SNAPSHOT_TIMEOUT_MS })
    .catch(() => '');
}

/**
 * Opens `url` once, like a run (GA4 requests marked as bot traffic), and reads what "Mit KI
 * beschreiben" needs: the accessibility tree of the page and its iframes, forms, the consent tool
 * and GA4 ids. Throws StepError with a German reason when the page cannot be read.
 */
export async function analysePage(context: BrowserContext, url: string): Promise<PageFacts> {
  await markBotTraffic(context, ANALYSIS_RUN_NR, ALL_MARKINGS_ON);
  // Before a job exists there is no choice yet: no ads, like a run by default.
  await blockAds(context);
  const page = await context.newPage();
  try {
    const locked = new StepError('Seite ist passwortgeschützt (HTTP 401).');
    const response = await openPage(page, url, OPEN_TIMEOUT_MS).catch((error: unknown) => {
      if (refusedCredentials(error)) throw locked;
      throw new StepError(`Seite lädt nicht (nach ${OPEN_TIMEOUT_MS / 1000} s).`);
    });
    if (response?.status() === 401) throw locked;
    if (response && response.status() >= 400) {
      throw new StepError(`Seite antwortet mit HTTP ${response.status()}.`);
    }
    // Consent banners and other overlays often arrive a moment after the load event.
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});

    const parts: string[] = [];
    for (const frame of page.frames()) {
      const snapshot = await frameSnapshot(frame);
      if (!snapshot.trim()) continue;
      parts.push(frame === page.mainFrame() ? snapshot : `# iframe ${frame.url()}\n${snapshot}`);
    }

    const found = await page.evaluate(() => ({
      forms: document.forms.length,
      requiredFields: document.querySelectorAll('[required], [aria-required="true"]').length,
      sources: [...document.querySelectorAll('script[src], iframe[src]')].map(
        (element) => (element as HTMLScriptElement | HTMLIFrameElement).src,
      ),
      scripts: [...document.scripts].map((script) => script.src || script.textContent || ''),
    }));
    const ga4 = [
      ...new Set(found.scripts.flatMap((text) => text.match(/\bG-[A-Z0-9]{4,12}\b/g) ?? [])),
    ];

    return {
      url: page.url(),
      title: await page.title(),
      snapshot: parts.join('\n\n').slice(0, MAX_SNAPSHOT_CHARS),
      forms: found.forms,
      requiredFields: found.requiredFields,
      cookieBanner: detectConsentTool([...found.sources, ...page.frames().map((f) => f.url())]),
      ga4,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}
