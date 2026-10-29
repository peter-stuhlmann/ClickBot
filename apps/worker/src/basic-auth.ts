import type { BrowserContext, Route } from 'playwright';

/** `Authorization` header of HTTP Basic Auth (.htaccess), UTF-8 encoded. */
export function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

/** Same scheme, host and port: the credentials never reach trackers, CDNs or ad servers. */
export function isSameOrigin(url: URL, origin: string): boolean {
  return url.origin === origin;
}

type Handler = (route: Route) => Promise<void>;
type Matcher = (url: URL) => boolean;
const active = new WeakMap<BrowserContext, { matcher: Matcher; handler: Handler }>();

/**
 * Sends the credentials with every request to `origin` from now on. A second step replaces the
 * first, so the newest credentials count.
 */
export async function useBasicAuth(
  context: BrowserContext,
  origin: string,
  header: string,
): Promise<void> {
  const previous = active.get(context);
  // unroute recognises a route by the very same matcher and handler functions.
  if (previous) await context.unroute(previous.matcher, previous.handler);
  const matcher: Matcher = (url) => isSameOrigin(url, origin);
  const handler: Handler = (route) =>
    route.fallback({ headers: { ...route.request().headers(), authorization: header } });
  await context.route(matcher, handler);
  active.set(context, { matcher, handler });
}

/** Whether a password protection step ran in this context. */
export function hasBasicAuth(context: BrowserContext): boolean {
  return active.has(context);
}
