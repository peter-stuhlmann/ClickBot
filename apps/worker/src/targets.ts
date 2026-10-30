import { unknownTagHint, type Target } from '@click-bot/shared';
import type { Frame, Locator, Page } from 'playwright';
import { StepError, formatSeconds } from './errors';

type AriaRole = Parameters<Page['getByRole']>[0];

const POLL_MS = 100;

/**
 * Turns a step target into a Playwright locator within one document. Names and labels match
 * exactly, so „Absenden“ never hits a button called „Absenden und weiter“.
 */
export function locate(scope: Page | Frame, target: Target): Locator {
  switch (target.by) {
    case 'role':
      return scope.getByRole(
        target.role as AriaRole,
        target.name ? { name: target.name, exact: true } : {},
      );
    case 'label':
      return scope.getByLabel(target.label, { exact: true });
    case 'text':
      return scope.getByText(target.text, { exact: target.exact });
    case 'css':
      return scope.locator(target.selector);
    case 'testId':
      return scope.getByTestId(target.testId);
  }
}

const pause = () => new Promise((resolve) => setTimeout(resolve, POLL_MS));

/**
 * The page a step works in, or a way to ask for it: while a step waits, a tab the previous click
 * opened may still arrive, and the waiting goes on in it (see runFlow).
 */
export type PageSource = Page | (() => Page);

export const pageOf = (source: PageSource): Page =>
  typeof source === 'function' ? source() : source;

/** Polls `check` until it holds; false when the time is up. */
export async function waitUntil(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() >= deadline) return false;
    await pause();
  }
}

/** Matches in a frame; 0 for a frame that went away in the meantime. */
const countIn = (locator: Locator) => locator.count().catch(() => 0);

/**
 * Finds the target in the page and in all its iframes: cookie banners and other overlays often
 * live in an iframe. Waits until exactly one element matches. More than one, in one document or
 * across several, is ambiguous: the step fails instead of guessing.
 */
export async function findTarget(
  page: PageSource,
  target: Target,
  timeoutMs: number,
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const matches = await Promise.all(
      pageOf(page)
        .frames()
        .map(async (frame) => {
          const locator = locate(frame, target);
          return { locator, count: await countIn(locator) };
        }),
    );
    const total = matches.reduce((sum, match) => sum + match.count, 0);
    if (total > 1) {
      throw new StepError(`Mehrdeutig: ${describeTarget(target)} passt auf ${total} Elemente.`);
    }
    const found = matches.find((match) => match.count === 1);
    if (found) return found.locator;
    if (Date.now() >= deadline) throw notFound(target, timeoutMs);
    await pause();
  }
}

/**
 * „Element nicht gefunden …“, for a CSS selector like „decline“ with what it really looks for
 * (an element <decline>) and what was probably meant.
 */
export function notFound(target: Target, timeoutMs: number): StepError {
  const message = `Element nicht gefunden: ${describeTarget(target)} (nach ${formatSeconds(timeoutMs)}).`;
  const hint = target.by === 'css' ? unknownTagHint(target.selector) : null;
  return new StepError(hint ? `${message} ${hint}` : message);
}

/** Waits until `text` is visible in the page or one of its iframes. */
export async function waitForVisibleText(
  page: PageSource,
  text: string,
  timeoutMs: number,
): Promise<boolean> {
  return waitUntil(async () => {
    const visible = await Promise.all(
      pageOf(page)
        .frames()
        .map((frame) =>
          frame
            .getByText(text)
            .first()
            .isVisible()
            .catch(() => false),
        ),
    );
    return visible.includes(true);
  }, timeoutMs);
}

/** Human-readable description for step messages and reports. */
export function describeTarget(target: Target): string {
  switch (target.by) {
    case 'role':
      return target.name
        ? `Rolle „${target.role}“ mit Name „${target.name}“`
        : `Rolle „${target.role}“`;
    case 'label':
      return `Feld „${target.label}“`;
    case 'text':
      return `Text „${target.text}“`;
    case 'css':
      return `CSS „${target.selector}“`;
    case 'testId':
      return `Test-ID „${target.testId}“`;
  }
}
