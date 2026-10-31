import type { Browser } from 'playwright';

export type BrowserManager = {
  /** The running browser; starts one if there is none yet or the last one crashed. */
  get(): Promise<Browser>;
  /** Closes the browser for good (worker shutdown). */
  close(): Promise<void>;
};

const CRASHED = 'Browser beendet oder abgestürzt. Der nächste Durchlauf startet einen neuen.';

/**
 * Keeps one shared browser (one engine) for all runs. If it crashes, the runs in it fail (with the browser's
 * message), and the next run gets a fresh browser instead of failing as well. Runs asking at the
 * same time share one start; a failed start is tried again by the next run.
 */
export function createBrowserManager(
  launch: () => Promise<Browser>,
  log: (message: string) => void = () => {},
): BrowserManager {
  let current: Promise<Browser> | null = null;
  let closed = false;

  function start(): Promise<Browser> {
    const starting = launch().then((browser) => {
      browser.on('disconnected', () => {
        if (current !== starting) return;
        current = null;
        if (!closed) log(CRASHED);
      });
      return browser;
    });
    starting.catch(() => {
      if (current === starting) current = null;
    });
    current = starting;
    return starting;
  }

  return {
    async get() {
      if (closed) throw new Error('Der Browser wurde beendet.');
      const browser = await (current ?? start());
      // The disconnect event may still be on its way; a closed browser is never handed out.
      return browser.isConnected() ? browser : start();
    },
    async close() {
      closed = true;
      const browser = await current?.catch(() => null);
      current = null;
      await browser?.close();
    },
  };
}
