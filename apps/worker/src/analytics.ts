const GA_HOST = /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/;

/**
 * Event names in a GA4 measurement request (`/g/collect`). gtag sends single events in the
 * query string and batches in the body, one hit per line.
 */
export function parseGa4Events(url: string, body: string | null): string[] {
  const parsed = new URL(url);
  if (!GA_HOST.test(parsed.hostname) || parsed.pathname !== '/g/collect') return [];

  const events: string[] = [];
  const fromUrl = parsed.searchParams.get('en');
  if (fromUrl) events.push(fromUrl);
  for (const line of (body ?? '').split('\n')) {
    const event = new URLSearchParams(line).get('en');
    if (event) events.push(event);
  }
  return events;
}

export type Ga4Recorder = {
  record(url: string, body: string | null): void;
  /** Resolves true as soon as `event` was sent (also if it already was), false after the timeout. */
  waitFor(event: string, timeoutMs: number): Promise<boolean>;
  events(): string[];
};

export function createGa4Recorder(): Ga4Recorder {
  const seen: string[] = [];
  const waiters = new Set<{ event: string; done: (sent: boolean) => void }>();

  return {
    record(url, body) {
      for (const event of parseGa4Events(url, body)) {
        seen.push(event);
        for (const waiter of waiters) if (waiter.event === event) waiter.done(true);
      }
    },

    waitFor(event, timeoutMs) {
      if (seen.includes(event)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const waiter = {
          event,
          done: (sent: boolean) => {
            clearTimeout(timer);
            waiters.delete(waiter);
            resolve(sent);
          },
        };
        const timer = setTimeout(() => waiter.done(false), timeoutMs);
        waiters.add(waiter);
      });
    },

    events: () => [...seen],
  };
}
