import { maskSecrets, type Flow } from '@click-bot/shared';
import type { BrowserContext } from 'playwright';
import { createGa4Recorder } from './analytics';
import { markBotTraffic } from './bot-marking';
import { toStepMessage } from './errors';
import { executeStep } from './steps';
import { createTestData } from './test-data';

const FAILURE_SCREENSHOT_TIMEOUT_MS = 3_000;

export type RunOptions = {
  /** Start URL of the job; relative `open` URLs resolve against it. */
  baseUrl: string;
  runNr: number;
  botNr: number;
  /** Secrets this run may use (see resolveSecretsForRun); masked in everything it returns. */
  secrets: Record<string, string>;
};

export type StepResult = {
  stepId: string;
  index: number;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  message?: string;
};

export type RunResult = {
  status: 'passed' | 'failed';
  steps: StepResult[];
  extracted: Record<string, string>;
  screenshots: { stepId: string; image: Buffer }[];
  analyticsEvents: string[];
};

/**
 * Runs a flow in a fresh page of `context` and stops at the first failing step; the rest are
 * reported as skipped. A failing step gets a screenshot of the moment it failed.
 */
export async function runFlow(
  context: BrowserContext,
  flow: Flow,
  options: RunOptions,
): Promise<RunResult> {
  await markBotTraffic(context, options.runNr);
  const analytics = createGa4Recorder();
  context.on('request', (request) => analytics.record(request.url(), request.postData()));
  const page = await context.newPage();

  const vars = {
    runNr: options.runNr,
    botNr: options.botNr,
    faker: createTestData(options.runNr, options.botNr),
    secrets: options.secrets,
  };
  const mask = (text: string) => maskSecrets(text, Object.values(options.secrets));

  const result: RunResult = {
    status: 'passed',
    steps: [],
    extracted: {},
    screenshots: [],
    analyticsEvents: [],
  };

  for (const [index, step] of flow.steps.entries()) {
    if (result.status === 'failed') {
      result.steps.push({ stepId: step.id, index, status: 'skipped', durationMs: 0 });
      continue;
    }

    const started = performance.now();
    const duration = () => Math.ceil(performance.now() - started);
    try {
      const outcome = await executeStep(page, step, { vars, baseUrl: options.baseUrl, analytics });
      if (step.type === 'extract' && outcome.extracted !== undefined) {
        result.extracted[step.saveAs] = mask(outcome.extracted);
      }
      if (outcome.screenshot)
        result.screenshots.push({ stepId: step.id, image: outcome.screenshot });
      result.steps.push({ stepId: step.id, index, status: 'passed', durationMs: duration() });
    } catch (error) {
      result.status = 'failed';
      result.steps.push({
        stepId: step.id,
        index,
        status: 'failed',
        durationMs: duration(),
        message: mask(toStepMessage(error)),
      });
      // Bounded: on a page that hangs, an unbounded screenshot would block the browser slot.
      const image = await page
        .screenshot({ timeout: FAILURE_SCREENSHOT_TIMEOUT_MS })
        .catch(() => null);
      if (image) result.screenshots.push({ stepId: step.id, image });
    }
  }

  result.analyticsEvents = analytics.events();
  await page.close();
  return result;
}
