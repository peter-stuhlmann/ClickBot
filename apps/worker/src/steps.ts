import { interpolate, type Step, type Target, type VariableContext } from '@click-bot/shared';
import type { Locator } from 'playwright';
import type { Ga4Recorder } from './analytics';
import { basicAuthHeader, hasBasicAuth, useBasicAuth } from './basic-auth';
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
        page.goto(url, { timeout }).catch((error: unknown) => {
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
      // Instantly, also on pages with smooth scrolling: the next step must find the page there.
      if (to.kind === 'element') {
        await onTarget(current, to.target, timeout, async (l, left) => {
          await l.waitFor({ state: 'visible', timeout: left });
          // Like scrollIntoViewIfNeeded: only if it is not in view yet, then to the middle.
          await l.evaluate((element) => {
            const box = element.getBoundingClientRect();
            if (box.top >= 0 && box.bottom <= window.innerHeight) return;
            element.scrollIntoView({ block: 'center', behavior: 'instant' });
          });
        });
        return {};
      }
      await page.evaluate(
        (y) => {
          const top = y ?? (document.scrollingElement ?? document.documentElement).scrollHeight;
          window.scrollTo({ top, behavior: 'instant' });
        },
        to.kind === 'position' ? to.y : null,
      );
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

    case 'ai':
      throw new StepError('KI-Schritte sind noch nicht verfügbar.');
  }
  return {};
}
