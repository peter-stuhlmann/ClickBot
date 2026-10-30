import { ALL_MARKINGS_ON, maskSecrets, type AnalyticsMarking, type Flow } from '@click-bot/shared';
import type { BrowserContext } from 'playwright';
import { createGa4Recorder } from './analytics';
import { markBotTraffic } from './bot-marking';
import { toStepMessage } from './errors';
import { waitForPdf } from './pdf';
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
  /** How the GA4 requests of the run are marked; default: everything. */
  analyticsMarking?: AnalyticsMarking;
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
 * reported as skipped. A failing step gets a screenshot of the moment it failed. When a step opens
 * a new tab (a link with target="_blank", window.open), the following steps go on in that tab.
 */
export async function runFlow(
  context: BrowserContext,
  flow: Flow,
  options: RunOptions,
): Promise<RunResult> {
  await markBotTraffic(context, options.runNr, options.analyticsMarking ?? ALL_MARKINGS_ON);
  const analytics = createGa4Recorder();
  context.on('request', (request) => analytics.record(request.url(), request.postData()));
  let page = await context.newPage();
  context.on('page', (opened) => {
    page = opened;
  });

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
      const outcome = await executeStep(() => page, step, {
        vars,
        baseUrl: options.baseUrl,
        analytics,
      });
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
      await waitForPdf(page, FAILURE_SCREENSHOT_TIMEOUT_MS);
      const image = await page
        .screenshot({ timeout: FAILURE_SCREENSHOT_TIMEOUT_MS })
        .catch(() => null);
      if (image) result.screenshots.push({ stepId: step.id, image });
    }
  }

  result.analyticsEvents = analytics.events();
  await Promise.all(context.pages().map((open) => open.close()));
  return result;
}
