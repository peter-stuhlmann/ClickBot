import { interpolate, type Step, type Target, type VariableContext } from '@click-bot/shared';
import type { Locator, Page } from 'playwright';
import type { Ga4Recorder } from './analytics';
import { basicAuthHeader, hasBasicAuth, useBasicAuth } from './basic-auth';
import { StepError, ambiguousCount, formatSeconds, isTimeout } from './errors';
import { describeTarget, findTarget, notFound, waitForVisibleText } from './targets';

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
  page: Page,
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

export async function executeStep(page: Page, step: Step, ctx: StepContext): Promise<StepOutcome> {
  // Variables are resolved before the page is touched, so an unknown one fails cleanly.
  const text = (template: string) => interpolate(template, ctx.vars).value;
  const timeout = step.timeoutMs;
  const after = formatSeconds(timeout);

  switch (step.type) {
    case 'open': {
      const url = new URL(text(step.url), ctx.baseUrl).href;
      const response = await onTimeout(
        page.goto(url, { timeout }),
        () => `Seite lädt nicht (nach ${after}).`,
      );
      if (response?.status() === 401) {
        throw new StepError(
          hasBasicAuth(page.context())
            ? 'Seite antwortet mit HTTP 401: Sie ist passwortgeschützt, Benutzername oder Passwort stimmen nicht.'
            : 'Seite antwortet mit HTTP 401: Sie ist passwortgeschützt. Davor gehört ein Schritt „Passwortschutz“.',
        );
      }
      if (response && response.status() >= 400) {
        throw new StepError(`Seite antwortet mit HTTP ${response.status()}.`);
      }
      return {};
    }

    case 'click':
      await onTarget(page, step.target, timeout, (l, left) => l.click({ timeout: left }));
      return {};

    case 'fill': {
      const value = text(step.value);
      await onTarget(page, step.target, timeout, (l, left) => l.fill(value, { timeout: left }));
      return {};
    }

    case 'select': {
      const option = text(step.option);
      const started = Date.now();
      const field = await findTarget(page, step.target, timeout);
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
          if (!(await waitForVisibleText(page, expected, timeout))) {
            throw new StepError(`Text „${expected}“ ist nicht sichtbar (nach ${after}).`);
          }
          return {};
        }
        case 'elementVisible':
          await onTarget(page, assertion.target, timeout, (l, left) =>
            l.waitFor({ state: 'visible', timeout: left }),
          );
          return {};
        case 'urlContains': {
          const expected = text(assertion.value);
          await onTimeout(
            page.waitForURL((url) => url.href.includes(expected), { timeout }),
            () => `URL enthält „${expected}“ nicht (aktuell: ${page.url()}).`,
          );
          return {};
        }
        case 'titleContains': {
          const expected = text(assertion.value);
          await onTimeout(
            page.waitForFunction((value) => document.title.includes(value), expected, { timeout }),
            async () =>
              `Seitentitel enthält „${expected}“ nicht (aktuell: „${await page.title()}“).`,
          );
          return {};
        }
      }
      break;
    }

    case 'extract': {
      const value = await onTarget(page, step.target, timeout, (l, left) =>
        l.textContent({ timeout: left }),
      );
      return { extracted: (value ?? '').trim() };
    }

    case 'wait': {
      const { until } = step;
      if (until.kind === 'duration') {
        await page.waitForTimeout(until.ms);
      } else if (until.kind === 'element') {
        await onTarget(page, until.target, timeout, (l, left) =>
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

    case 'screenshot':
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
