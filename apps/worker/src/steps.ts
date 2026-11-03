import { interpolate, type Step, type Target, type VariableContext } from '@click-bot/shared';
import type { Locator } from 'playwright';
import type { Ga4Recorder } from './analytics';
import { basicAuthHeader, hasBasicAuth, useBasicAuth } from './basic-auth';
import { openPage } from './navigate';
import { waitForPdf } from './pdf';
import { StepError, ambiguousCount, formatSeconds, isTimeout, refusedCredentials } from './errors';
import {
  describeTarget,
  findTarget,
  notFound,
  pageOf,
  waitForVisibleText,
  waitUntil,
  type PageSource,
} from './targets';

export type StepContext = {
  vars: VariableContext;
  baseUrl: string;
  analytics: Ga4Recorder;
};

export type StepOutcome = {
  extracted?: string;
  screenshot?: Buffer;
};

/**
 * Finds the target (also in iframes), runs `action` on it with the time that is left, and
 * translates Playwright errors into report text.
 */
async function onTarget<T>(
  page: PageSource,
  target: Target,
  timeoutMs: number,
  action: (locator: Locator, timeout: number) => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const locator = await findTarget(page, target, timeoutMs);
  const left = Math.max(1, timeoutMs - (Date.now() - started));
  try {
    return await action(locator, left);
  } catch (error) {
    const count = ambiguousCount(error);
    if (count !== null) {
      throw new StepError(`Mehrdeutig: ${describeTarget(target)} passt auf ${count} Elemente.`);
    }
    if (isTimeout(error)) throw notFound(target, timeoutMs);
    throw error;
  }
}

/** Where a scroll goes: a position (null keeps that axis), or a distance from where it stands. */
type Glide = { x: number | null; y: number | null; relative: boolean };

/**
 * In the browser: scrolls the window of `element` to the target, frame by frame, easing in and
 * out, at most 0.8 s, so the live view shows the way instead of a jump (headless browsers do not
 * animate scrolling themselves, not even `behavior: 'smooth'`). Instant steps, also on pages that
 * scroll smoothly by CSS, then exactly there; it returns after the page got its "scroll" event,
 * so the next step finds the page in place. Self-contained: Playwright sends only its source.
 */
async function glide(element: Element, to: Glide): Promise<void> {
  const view = element.ownerDocument.defaultView ?? window;
  const root = view.document.scrollingElement ?? view.document.documentElement;
  const from = { x: view.scrollX, y: view.scrollY };
  const aim = (axis: number | null, start: number, max: number) =>
    Math.min(Math.max(0, axis === null ? start : to.relative ? start + axis : axis), max);
  const x = aim(to.x, from.x, root.scrollWidth - root.clientWidth);
  const y = aim(to.y, from.y, root.scrollHeight - root.clientHeight);
  // A frame, or 50 ms where the browser paints none (a window in the background).
  const frame = () =>
    new Promise<number>((resolve) => {
      view.requestAnimationFrame(resolve);
      setTimeout(() => resolve(view.performance.now()), 50);
    });
  const distance = Math.hypot(x - from.x, y - from.y);
  if (distance >= 1) {
    const duration = Math.min(800, 200 + distance / 3);
    const start = view.performance.now();
    for (let t = 0; t < 1;) {
      t = Math.min(1, ((await frame()) - start) / duration);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      view.scrollTo({
        left: from.x + (x - from.x) * eased,
        top: from.y + (y - from.y) * eased,
        behavior: 'instant',
      });
    }
  }
  view.scrollTo({ left: x, top: y, behavior: 'instant' });
  await frame();
}

// A tab a page opens by script (window.open) is reported a few ms after the click; measured up to
// 27 ms in Chromium, Firefox and WebKit. Ten times that covers a busy server.
const NEW_TAB_GRACE_MS = 250;

/** Whether a click on the element opens another tab: a link or form with a target of its own. */
function opensNewTab(element: Element): boolean {
  const owner =
    element.closest('a[href], area[href]') ??
    (element.closest('button, input') as HTMLButtonElement | HTMLInputElement | null)?.form;
  const target = (owner?.getAttribute('target') ?? '').toLowerCase();
  return target !== '' && !['_self', '_parent', '_top'].includes(target);
}

async function onTimeout<T>(
  action: Promise<T>,
  message: () => string | Promise<string>,
): Promise<T> {
  try {
    return await action;
  } catch (error) {
    if (isTimeout(error)) throw new StepError(await message());
    throw error;
  }
}

/**
 * Runs one step. `current` gives the page to work in; steps that wait ask it again while waiting,
 * so a tab the previous click opened late is still where they look.
 */
export async function executeStep(
  current: PageSource,
  step: Step,
  ctx: StepContext,
): Promise<StepOutcome> {
  const page = pageOf(current);
  // Variables are resolved before the page is touched, so an unknown one fails cleanly.
  const text = (template: string) => interpolate(template, ctx.vars).value;
  const timeout = step.timeoutMs;
  const after = formatSeconds(timeout);

  switch (step.type) {
    case 'open': {
      const url = new URL(text(step.url), ctx.baseUrl).href;
      const response = await onTimeout(
        openPage(page, url, timeout).catch((error: unknown) => {
          if (refusedCredentials(error)) return 401 as const;
          throw error;
        }),
        () => `Seite lädt nicht (nach ${after}).`,
      );
      const status = response === 401 ? 401 : response?.status();
      if (status === 401) {
        throw new StepError(
          hasBasicAuth(page.context())
            ? 'Seite antwortet mit HTTP 401: Sie ist passwortgeschützt, Benutzername oder Passwort stimmen nicht.'
            : 'Seite antwortet mit HTTP 401: Sie ist passwortgeschützt. Davor gehört ein Schritt „Passwortschutz“.',
        );
      }
      if (status && status >= 400) {
        throw new StepError(`Seite antwortet mit HTTP ${status}.`);
      }
      return {};
    }

    case 'click':
      await onTarget(current, step.target, timeout, async (l, left) => {
        // A new tab must be there before the next step, which goes on in it (runFlow). A link with
        // a target is waited for; a tab opened by script only for a moment.
        const expected = await l.evaluate(opensNewTab, undefined, { timeout: left });
        const newTab = page
          .context()
          .waitForEvent('page', { timeout: expected ? left : NEW_TAB_GRACE_MS })
          .catch(() => undefined);
        await l.click({ timeout: left });
        // Loaded before the next step, so a photo right after shows the page (or the PDF).
        const tab = await newTab;
        await tab?.waitForLoadState('load', { timeout: left }).catch(() => undefined);
      });
      return {};

    case 'fill': {
      const value = text(step.value);
      await onTarget(current, step.target, timeout, (l, left) => l.fill(value, { timeout: left }));
      return {};
    }

    case 'select': {
      const option = text(step.option);
      const started = Date.now();
      const field = await findTarget(current, step.target, timeout);
      try {
        await field.selectOption(option, {
          timeout: Math.max(1, timeout - (Date.now() - started)),
        });
      } catch (error) {
        // The field exists (findTarget found it), so a timeout here means the option is missing;
        // say so instead of claiming the field is missing.
        if (!isTimeout(error)) throw error;
        const options = (await field.locator('option').allTextContents()).map((o) => o.trim());
        throw new StepError(
          `Option „${option}“ gibt es in ${describeTarget(step.target)} nicht. ` +
            `Vorhanden: ${options.join(', ')}.`,
        );
      }
      return {};
    }

    case 'assert': {
      const { assertion } = step;
      switch (assertion.kind) {
        case 'textVisible': {
          const expected = text(assertion.text);
          if (!(await waitForVisibleText(current, expected, timeout))) {
            throw new StepError(`Text „${expected}“ ist nicht sichtbar (nach ${after}).`);
          }
          return {};
        }
        case 'elementVisible':
          await onTarget(current, assertion.target, timeout, (l, left) =>
            l.waitFor({ state: 'visible', timeout: left }),
          );
          return {};
        case 'urlContains': {
          const expected = text(assertion.value);
          if (!(await waitUntil(() => pageOf(current).url().includes(expected), timeout))) {
            throw new StepError(
              `URL enthält „${expected}“ nicht (aktuell: ${pageOf(current).url()}).`,
            );
          }
          return {};
        }
        case 'titleContains': {
          const expected = text(assertion.value);
          const title = () =>
            pageOf(current)
              .title()
              .catch(() => '');
          if (!(await waitUntil(async () => (await title()).includes(expected), timeout))) {
            throw new StepError(
              `Seitentitel enthält „${expected}“ nicht (aktuell: „${await title()}“).`,
            );
          }
          return {};
        }
      }
      break;
    }

    case 'extract': {
      const value = await onTarget(current, step.target, timeout, (l, left) =>
        l.textContent({ timeout: left }),
      );
      return { extracted: (value ?? '').trim() };
    }

    case 'wait': {
      const { until } = step;
      if (until.kind === 'duration') {
        await page.waitForTimeout(until.ms);
      } else if (until.kind === 'element') {
        await onTarget(current, until.target, timeout, (l, left) =>
          l.waitFor({ state: 'visible', timeout: left }),
        );
      } else {
        await onTimeout(
          page.waitForLoadState('networkidle', { timeout }),
          () => `Seite kommt nicht zur Ruhe (nach ${after}).`,
        );
      }
      return {};
    }

    case 'scroll': {
      const { to } = step;
      if (to.kind === 'element') {
        await onTarget(current, to.target, timeout, async (l, left) => {
          await l.waitFor({ state: 'visible', timeout: left });
          // Like scrollIntoViewIfNeeded: only if it is not in view yet, then to the middle.
          // Sideways it is enough to see a part, as of a block wider than the window. Where that
          // is, the browser says: there and back within one task, so nothing is painted.
          const target = await l.evaluate((element) => {
            const view = element.ownerDocument.defaultView ?? window;
            const box = element.getBoundingClientRect();
            const vertical = box.top >= 0 && box.bottom <= view.innerHeight;
            const horizontal = box.right > 0 && box.left < view.innerWidth;
            if (vertical && horizontal) return null;
            const from = { x: view.scrollX, y: view.scrollY };
            element.scrollIntoView({
              block: vertical ? 'nearest' : 'center',
              inline: horizontal ? 'nearest' : 'center',
              behavior: 'instant',
            });
            const there = { x: view.scrollX, y: view.scrollY, relative: false };
            view.scrollTo({ left: from.x, top: from.y, behavior: 'instant' });
            return there;
          });
          if (target) await l.evaluate(glide, target);
        });
        return {};
      }
      const targets: Record<Exclude<typeof to.kind, 'element' | 'by' | 'position'>, Glide> = {
        top: { x: null, y: 0, relative: false },
        bottom: { x: null, y: Infinity, relative: false },
        left: { x: 0, y: null, relative: false },
        right: { x: Infinity, y: null, relative: false },
      };
      const by = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] } as const;
      const target: Glide =
        to.kind === 'by'
          ? {
              x: by[to.direction][0] * to.distance,
              y: by[to.direction][1] * to.distance,
              relative: true,
            }
          : to.kind === 'position'
            ? // Without x the page keeps its horizontal position.
              { x: to.x ?? null, y: to.y, relative: false }
            : targets[to.kind];
      await page.locator('html').evaluate(glide, target);
      return {};
    }

    case 'press': {
      // Playwright calls the space bar " "; the flow writes it as „Space“, which can be read.
      const key = step.key.replace(/(^|\+)Space$/, '$1 ');
      if (step.target) {
        await onTarget(current, step.target, timeout, (l, left) => l.press(key, { timeout: left }));
      } else {
        await page.keyboard.press(key);
      }
      return {};
    }

    case 'screenshot':
      await waitForPdf(page, timeout);
      return { screenshot: await page.screenshot({ fullPage: step.fullPage }) };

    case 'analytics': {
      const event = text(step.event);
      if (!(await ctx.analytics.waitFor(event, timeout))) {
        const sent = ctx.analytics.events();
        throw new StepError(
          `GA4-Event „${event}“ wurde nicht gesendet (nach ${after}). ` +
            `Gesendet: ${sent.length > 0 ? sent.join(', ') : 'keine'}.`,
        );
      }
      return {};
    }

    case 'basicAuth': {
      // Only to the job's own domain; the password is a secret, so it is masked everywhere.
      const header = basicAuthHeader(text(step.username), text(step.password));
      await useBasicAuth(page.context(), new URL(ctx.baseUrl).origin, header);
      return {};
    }

    // runFlow runs AI steps (ai-step.ts); the actions of the AI never contain another one.
    case 'ai':
      throw new StepError('Ein KI-Schritt läuft nur als Teil eines Ablaufs.');
  }
  return {};
}
