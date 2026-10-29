import { ALL_MARKINGS_ON } from '@click-bot/shared';
import type { BrowserContext, Page } from 'playwright';
import { markBotTraffic } from './bot-marking';
import { toStepMessage } from './errors';
import { startRecorder, type RecordedStep, type RecorderMode } from './recorder';

/** Size of the live browser, as in the design ("Chromium auf dem Server · 1280 × 800"). */
export const LIVE_VIEWPORT = { width: 1280, height: 800 } as const;

const MAX_TEXT = 2_000;
const MAX_WHEEL = 5_000;
const OPEN_TIMEOUT_MS = 20_000;
const SCREENCAST_QUALITY = 60;
// Plain key names only: no shortcuts like Control+Shift+I that open developer tools.
const KEY =
  /^(Enter|Tab|Backspace|Delete|Escape|Space|Home|End|PageUp|PageDown|Arrow(Up|Down|Left|Right))$/;
// Analyses and recordings are no runs: their GA4 requests carry run number 0.
const NO_RUN = 0;

/** A step the recording produced: an opened address or a recorded action. */
export type LiveStep = { type: 'open'; url: string } | RecordedStep;

export type ClientMessage =
  | { type: 'click'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'wheel'; dx: number; dy: number }
  | { type: 'key'; key: string }
  | { type: 'text'; text: string }
  | { type: 'navigate'; url: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'mode'; mode: RecorderMode };

export type ServerMessage =
  | { type: 'ready'; viewport: typeof LIVE_VIEWPORT; url: string }
  | { type: 'frame'; data: string }
  | { type: 'url'; url: string }
  | { type: 'step'; step: LiveStep }
  | { type: 'mode'; mode: RecorderMode }
  | { type: 'error'; message: string };

export type LiveSession = {
  handle(message: ClientMessage): Promise<void>;
  close(): Promise<void>;
};

const isNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function isWebAddress(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Checks a message from the browser strictly: only these few actions can reach the live
 * browser, inside its viewport, with plain keys and web addresses. Anything else is null.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  let message: Record<string, unknown>;
  try {
    message = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const { type } = message;
  const { width, height } = LIVE_VIEWPORT;
  switch (type) {
    case 'click':
    case 'move':
      return isNumber(message.x, 0, width) && isNumber(message.y, 0, height)
        ? { type, x: message.x, y: message.y }
        : null;
    case 'wheel':
      return isNumber(message.dx, -MAX_WHEEL, MAX_WHEEL) &&
        isNumber(message.dy, -MAX_WHEEL, MAX_WHEEL)
        ? { type, dx: message.dx, dy: message.dy }
        : null;
    case 'key':
      return typeof message.key === 'string' && KEY.test(message.key)
        ? { type, key: message.key }
        : null;
    case 'text':
      return typeof message.text === 'string' && message.text.length <= MAX_TEXT
        ? { type, text: message.text }
        : null;
    case 'navigate':
      return isWebAddress(message.url) ? { type, url: message.url } : null;
    case 'back':
    case 'forward':
    case 'reload':
      return { type };
    case 'mode':
      return message.mode === 'record' || message.mode === 'browse' || message.mode === 'assert'
        ? { type, mode: message.mode }
        : null;
    default:
      return null;
  }
}

async function open(page: Page, url: string): Promise<string | null> {
  try {
    const response = await page.goto(url, { timeout: OPEN_TIMEOUT_MS });
    if (response && response.status() >= 400)
      return `Seite antwortet mit HTTP ${response.status()}.`;
    return null;
  } catch (error) {
    return toStepMessage(error);
  }
}

/**
 * "Im Browser aufnehmen": opens `startUrl` in `context` (one page, GA4 marked as bot traffic),
 * streams it as JPEG frames and records what the user does there as steps. `send` gets every
 * message for the browser of the user.
 */
export async function startLiveSession(
  context: BrowserContext,
  startUrl: string,
  send: (message: ServerMessage) => void,
): Promise<LiveSession> {
  await markBotTraffic(context, NO_RUN, ALL_MARKINGS_ON);
  const recorder = await startRecorder(context, (step) => {
    send({ type: 'step', step });
    if (step.type === 'assert') send({ type: 'mode', mode: recorder.mode() });
  });
  const page = await context.newPage();
  let closed = false;

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) send({ type: 'url', url: frame.url() });
  });
  // The live view shows one tab: a link that opens a new one continues in this one.
  context.on('page', async (popup) => {
    if (popup === page) return;
    await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
    const url = popup.url();
    await popup.close().catch(() => undefined);
    if (isWebAddress(url)) await open(page, url);
  });

  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    if (closed) return;
    send({ type: 'frame', data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
  });

  send({ type: 'ready', viewport: LIVE_VIEWPORT, url: startUrl });
  send({ type: 'step', step: { type: 'open', url: startUrl } });
  const problem = await open(page, startUrl);
  if (problem) send({ type: 'error', message: problem });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: SCREENCAST_QUALITY });

  /** Back and forward are no steps; the flow opens the address it lands on instead. */
  const recordWhereWeAre = () => {
    if (recorder.mode() === 'record' && isWebAddress(page.url())) {
      send({ type: 'step', step: { type: 'open', url: page.url() } });
    }
  };

  return {
    async handle(message) {
      switch (message.type) {
        case 'click':
          return page.mouse.click(message.x, message.y);
        case 'move':
          return page.mouse.move(message.x, message.y);
        case 'wheel':
          return page.mouse.wheel(message.dx, message.dy);
        case 'key':
          return page.keyboard.press(message.key === 'Space' ? ' ' : message.key);
        case 'text':
          return page.keyboard.insertText(message.text);
        case 'navigate': {
          if (recorder.mode() === 'record') {
            send({ type: 'step', step: { type: 'open', url: message.url } });
          }
          const failed = await open(page, message.url);
          if (failed) send({ type: 'error', message: failed });
          return;
        }
        case 'back':
          await page.goBack().catch(() => undefined);
          return recordWhereWeAre();
        case 'forward':
          await page.goForward().catch(() => undefined);
          return recordWhereWeAre();
        case 'reload':
          await page.reload().catch(() => undefined);
          return;
        case 'mode':
          await recorder.setMode(message.mode);
          send({ type: 'mode', mode: message.mode });
          return;
      }
    },
    async close() {
      closed = true;
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await context.close().catch(() => undefined);
    },
  };
}
