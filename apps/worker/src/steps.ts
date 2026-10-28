import { interpolate, type Step, type Target, type VariableContext } from '@click-bot/shared';
import type { Locator, Page } from 'playwright';
import type { Ga4Recorder } from './analytics';
import { StepError, ambiguousCount, formatSeconds, isTimeout } from './errors';
import { describeTarget, locate } from './targets';

export type StepContext = {
  vars: VariableContext;
  baseUrl: string;
  analytics: Ga4Recorder;
};

export type StepOutcome = {
  extracted?: string;
  screenshot?: Buffer;
};

/** Runs `action` on the target's locator and translates Playwright errors into report text. */
async function onTarget<T>(
  page: Page,
  target: Target,
  timeoutMs: number,
  action: (locator: Locator) => Promise<T>,
): Promise<T> {
  try {
    return await action(locate(page, target));
  } catch (error) {
    const count = ambiguousCount(error);
    if (count !== null) {
      throw new StepError(`Mehrdeutig: ${describeTarget(target)} passt auf ${count} Elemente.`);
    }
    if (isTimeout(error)) {
      throw new StepError(
        `Element nicht gefunden: ${describeTarget(target)} (nach ${formatSeconds(timeoutMs)}).`,
      );
    }
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
      if (response && response.status() >= 400) {
        throw new StepError(`Seite antwortet mit HTTP ${response.status()}.`);
      }
      return {};
    }

    case 'click':
      await onTarget(page, step.target, timeout, (l) => l.click({ timeout }));
      return {};

    case 'fill': {
      const value = text(step.value);
      await onTarget(page, step.target, timeout, (l) => l.fill(value, { timeout }));
      return {};
    }

    case 'select': {
      const option = text(step.option);
      const field = locate(page, step.target);
      try {
        await onTarget(page, step.target, timeout, (l) => l.selectOption(option, { timeout }));
      } catch (error) {
        // selectOption also times out when the field exists but the option does not; say so
        // instead of claiming the field is missing.
        if ((await field.count()) !== 1) throw error;
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
          await onTimeout(
            page.getByText(expected).first().waitFor({ state: 'visible', timeout }),
            () => `Text „${expected}“ ist nicht sichtbar (nach ${after}).`,
          );
          return {};
        }
        case 'elementVisible':
          await onTarget(page, assertion.target, timeout, (l) =>
            l.waitFor({ state: 'visible', timeout }),
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
      const value = await onTarget(page, step.target, timeout, (l) => l.textContent({ timeout }));
      return { extracted: (value ?? '').trim() };
    }

    case 'wait': {
      const { until } = step;
      if (until.kind === 'duration') {
        await page.waitForTimeout(until.ms);
      } else if (until.kind === 'element') {
        await onTarget(page, until.target, timeout, (l) =>
          l.waitFor({ state: 'visible', timeout }),
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

    case 'ai':
      throw new StepError('KI-Schritte sind noch nicht verfügbar.');

    case 'code':
      throw new StepError('Code-Schritte sind noch nicht verfügbar.');
  }
  return {};
}
