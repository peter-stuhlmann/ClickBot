import type { BrowserContext } from 'playwright';

/**
 * Bot runs must never count as real visits (product rule): every GA4 measurement request of a
 * run is marked before it leaves the browser.
 *
 * - `_dbg=1` (debug mode): GA4 shows the events only in DebugView, never in the reports.
 * - `ep.traffic_type=internal`: an active "Internal traffic" data filter excludes them as well.
 * - `ep.click_bot=1`, `epn.click_bot_run=<run number>`: our own marker, to find a run in
 *   DebugView or a BigQuery export.
 */

const GA_HOST = /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/;

/**
 * A GA4 measurement request: `/g/collect` on Google's hosts, or on any host with a GA4
 * measurement id (server-side tagging on the customer's own domain).
 */
export function isGa4CollectUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!parsed.pathname.endsWith('/g/collect')) return false;
  return GA_HOST.test(parsed.hostname) || /^G-/.test(parsed.searchParams.get('tid') ?? '');
}

/** The request URL with the bot markers; values the website set are replaced. */
export function markGa4Url(url: string, runNr: number): string {
  const marked = new URL(url);
  marked.searchParams.set('_dbg', '1');
  marked.searchParams.set('ep.traffic_type', 'internal');
  marked.searchParams.set('ep.click_bot', '1');
  marked.searchParams.set('epn.click_bot_run', String(runNr));
  return marked.toString();
}

/**
 * Marks every GA4 request of the context. `fallback` passes the changed request on to other
 * handlers (in tests: the network guard) or, without any, to the network.
 */
export async function markBotTraffic(context: BrowserContext, runNr: number): Promise<void> {
  await context.route(
    (url) => isGa4CollectUrl(url.toString()),
    (route) => route.fallback({ url: markGa4Url(route.request().url(), runNr) }),
  );
}
