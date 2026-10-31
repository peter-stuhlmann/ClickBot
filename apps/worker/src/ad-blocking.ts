import type { BrowserContext } from 'playwright';
import { isGa4CollectUrl } from './bot-marking';

/**
 * Bot runs must not create ad impressions or clicks (product rule): ad networks cannot tell a
 * bot apart, and automated impressions count as invalid traffic for the website's ad account.
 * A job can allow ads (jobs.block_ads); the run records what it did.
 *
 * Only ad networks: GA4 and the tag manager stay (they are marked instead, see bot-marking.ts),
 * and so does Google's consent banner (fundingchoicesmessages.google.com), so tests see the page
 * as visitors do.
 */
const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adtrafficquality.google',
  'amazon-adsystem.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'adnxs.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'indexww.com',
  'adsrvr.org',
  'smartadserver.com',
  'yieldlab.net',
  'adform.net',
  'teads.tv',
  'media.net',
  'moatads.com',
  'sharethrough.com',
  '33across.com',
];

/** adservice.google.com, adservice.google.de, … */
const GOOGLE_AD_SERVICE = /^adservice\.google\.[a-z.]+$/;

/** Whether `url` goes to an ad network; GA4 measurement requests never count as ads. */
export function isAdRequest(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (isGa4CollectUrl(url)) return false;
  if (GOOGLE_AD_SERVICE.test(host)) return true;
  return AD_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Stops every request of the context to an ad network, as an ad blocker would. Returns how many
 * it stopped so far.
 */
export async function blockAds(context: BrowserContext): Promise<() => number> {
  let blocked = 0;
  await context.route(
    (url) => isAdRequest(url.toString()),
    (route) => {
      blocked += 1;
      return route.abort('blockedbyclient');
    },
  );
  return () => blocked;
}
