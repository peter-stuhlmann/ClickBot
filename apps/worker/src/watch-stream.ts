import type { Page } from 'playwright';
import type { RunEvent, StepStatus, WatchedRun } from './run-watch';
import { exposesSecret } from './conceal';

/** What a watcher of a run gets, as JSON over the WebSocket. */
export type WatchMessage =
  /** The run has not started yet (waits for a free browser). */
  | { type: 'waiting' }
  /** A JPEG of the page, base64. */
  | { type: 'frame'; data: string }
  /** The page shows a secret that is not blurred: no picture until it is gone. */
  | { type: 'hidden' }
  | { type: 'step'; index: number; total: number; status: StepStatus }
  | { type: 'ended'; status: string }
  | { type: 'error'; message: string };

/** How the pictures of a stream are taken: JPEG quality, longest side, and how often. */
export type FrameQuality = {
  quality: number;
  /** Chromium's screencast scales larger pictures down to this. */
  maxSide: number;
  /** Firefox and WebKit have no screencast: a screenshot this often instead. */
  snapshotEveryMs: number;
};

/** For watching live: light pictures, so the connection stays quick. */
export const LIVE_FRAMES: FrameQuality = { quality: 60, maxSide: 1280, snapshotEveryMs: 500 };

const SNAPSHOT_TIMEOUT_MS = 2_000;
const SECRET_CHECK_MS = 1_000;

type Feed = { stop(): Promise<void> };

/** A quiet page is shown again after this long without a picture. */
const QUIET_REFRESH_MS = 1_000;

/**
 * Chromium paints its frames over CDP, only when the page changes. That can leave a watcher with
 * no picture at all: a screencast that starts while the page navigates may lose its pictures, and
 * a page that then stands still paints nothing more. So a page that was quiet for a second is
 * shown again with a screenshot.
 */
async function screencast(
  page: Page,
  frame: (data: string) => void,
  quality: FrameQuality,
): Promise<Feed> {
  const cdp = await page.context().newCDPSession(page);
  let lastFrameAt = Date.now();
  const show = (data: string) => {
    lastFrameAt = Date.now();
    frame(data);
  };
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    show(data);
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: quality.quality,
    maxWidth: quality.maxSide,
    maxHeight: quality.maxSide,
  });
  let refreshing = false;
  const refresh = setInterval(() => {
    if (refreshing || Date.now() - lastFrameAt < QUIET_REFRESH_MS) return;
    refreshing = true;
    cdp
      .send('Page.captureScreenshot', { format: 'jpeg', quality: quality.quality })
      .then((shot) => show(shot.data))
      .catch(() => undefined)
      .finally(() => {
        refreshing = false;
      });
  }, QUIET_REFRESH_MS / 2);
  return {
    async stop() {
      clearInterval(refresh);
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    },
  };
}

/** Firefox and WebKit: a screenshot of the visible part, one after another. */
function snapshots(page: Page, frame: (data: string) => void, quality: FrameQuality): Feed {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const next = async () => {
    const image = await page
      .screenshot({ type: 'jpeg', quality: quality.quality, timeout: SNAPSHOT_TIMEOUT_MS })
      .catch(() => null);
    if (stopped) return;
    if (image) frame(image.toString('base64'));
    timer = setTimeout(() => void next(), quality.snapshotEveryMs);
  };
  void next();
  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

/**
 * Streams a running run to one watcher: the page it works in (a new tab included) and each step
 * as it starts and ends, until the run ends. Product rule: secrets never appear in pictures. The
 * pages of a run blur them (concealSecrets); in a run with secrets, a frame only goes out after a
 * look at the page found none in the clear (newer frames replace one that waits).
 * `quality`: light pictures for watching (default), finer ones for a video.
 * Returns a function that stops the stream.
 */
export function streamRun(
  run: WatchedRun,
  send: (message: WatchMessage) => void,
  quality: FrameQuality = LIVE_FRAMES,
): () => Promise<void> {
  let stopped = false;
  let feed: Feed | null = null;
  let attaching = Promise.resolve();
  let hidden = false;
  let pending: string | null = null;
  let checking = false;

  const hide = () => {
    if (!hidden) send({ type: 'hidden' });
    hidden = true;
  };

  /** Whether the page may be shown now; says "hidden" once when it may not. */
  const clean = async () => {
    const page = run.page();
    const shows = page !== null && (await exposesSecret(page, run.secrets));
    if (shows) hide();
    return !shows;
  };

  /** Sends the newest waiting frame once the page shows no secret; one look at a time. */
  const flush = async () => {
    if (checking) return;
    checking = true;
    try {
      while (pending !== null && !stopped) {
        const data = pending;
        pending = null;
        if (await clean()) {
          hidden = false;
          if (!stopped) send({ type: 'frame', data });
        }
      }
    } finally {
      checking = false;
    }
  };

  const frame = (data: string) => {
    if (stopped) return;
    if (run.secrets.length === 0) return send({ type: 'frame', data });
    pending = data;
    void flush();
  };

  const attach = (page: Page) => {
    attaching = attaching.then(async () => {
      await feed?.stop();
      feed = null;
      if (stopped || page.isClosed()) return;
      try {
        feed =
          run.engine === 'chromium'
            ? await screencast(page, frame, quality)
            : snapshots(page, frame, quality);
      } catch {
        // The page closed meanwhile; the next page attaches again.
      }
    });
  };

  /**
   * A hidden page that shows no secret any more comes back with a fresh frame: the screencast
   * only paints changes, and the frames from before were not sent.
   */
  const recheck = async () => {
    const page = run.page();
    if (!hidden || stopped || !page || checking) return;
    if (await clean()) attach(page);
  };

  const onEvent = (event: RunEvent) => {
    if (stopped) return;
    switch (event.type) {
      case 'page':
        return attach(event.page);
      case 'step': {
        const { index, total, status } = event;
        return send({ type: 'step', index, total, status });
      }
      case 'end':
        return send({ type: 'ended', status: event.status });
    }
  };

  const unsubscribe = run.subscribe(onEvent);
  const last = run.lastStep();
  if (last) onEvent(last);
  const page = run.page();
  if (page) attach(page);
  const checks =
    run.secrets.length > 0
      ? setInterval(() => void recheck().catch(() => undefined), SECRET_CHECK_MS)
      : undefined;

  return async () => {
    stopped = true;
    unsubscribe();
    clearInterval(checks);
    await attaching;
    await feed?.stop();
  };
}
