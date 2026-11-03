import {
  ALL_MARKINGS_ON,
  maskSecrets,
  type AnalyticsMarking,
  type Criterion,
  type Flow,
} from '@click-bot/shared';
import type { BrowserContext } from 'playwright';
import { blockAds } from './ad-blocking';
import { AiStepError, runAiStep, type AgentDriver } from './ai-step';
import { createGa4Recorder } from './analytics';
import { markBotTraffic } from './bot-marking';
import { concealSecrets, exposesSecret } from './conceal';
import { ExpectationError, toStepMessage } from './errors';
import { waitForPdf } from './pdf';
import type { RunTap } from './run-watch';
import { executeStep } from './steps';
import { createTestData } from './test-data';

const FAILURE_SCREENSHOT_TIMEOUT_MS = 3_000;
const LEFT_OUT =
  'Bildschirmfoto ausgelassen: Die Seite zeigte Zugangsdaten, die sich nicht abdecken ließen.';

export type RunOptions = {
  /** Start URL of the job; relative `open` URLs resolve against it. */
  baseUrl: string;
  runNr: number;
  botNr: number;
  /** Secrets this run may use (see resolveSecretsForRun); masked in everything it returns. */
  secrets: Record<string, string>;
  /** How the GA4 requests of the run are marked; default: everything. */
  analyticsMarking?: AnalyticsMarking;
  /** Whether requests to ad networks are stopped; default: yes. */
  blockAds?: boolean;
  /** The AI for AI steps; without it they fail and say why. */
  ai?: AgentDriver;
  /** Told the page and each step as the run goes, for "Live zuschauen". */
  tap?: RunTap;
};

export type StepResult = {
  stepId: string;
  index: number;
  /** unclear: an AI step could not check every sub-goal; the run goes on with a warning. */
  status: 'passed' | 'unclear' | 'failed' | 'skipped';
  durationMs: number;
  message?: string;
  /** AI step: what the AI did, one line per action, masked. */
  aiActions?: string[];
  /** AI step: the verdict per sub-goal, masked. */
  aiVerdict?: Criterion[];
};

export type RunResult = {
  /**
   * warning: every step passed, but an AI step could not check everything. not_passed: the flow
   * worked, but an expectation was not met (check, GA4 event, verdict of an AI step). failed: a
   * step could not be carried out.
   */
  status: 'passed' | 'warning' | 'not_passed' | 'failed';
  steps: StepResult[];
  extracted: Record<string, string>;
  screenshots: { stepId: string; image: Buffer }[];
  analyticsEvents: string[];
  /** Requests to ad networks the run stopped; 0 when ads were allowed. */
  blockedAdRequests: number;
};

/**
 * Runs a flow in a fresh page of `context` and stops at the first failing step; the rest are
 * reported as skipped. A failing step gets a screenshot of the moment it failed. When a step opens
 * a new tab (a link with target="_blank", window.open), the following steps go on in that tab.
 * Product rule: secrets never appear in pictures. Every page blurs them (concealSecrets); a
 * screenshot that could still show one in the clear is left out.
 */
export async function runFlow(
  context: BrowserContext,
  flow: Flow,
  options: RunOptions,
): Promise<RunResult> {
  const secrets = Object.values(options.secrets);
  await concealSecrets(context, secrets);
  await markBotTraffic(context, options.runNr, options.analyticsMarking ?? ALL_MARKINGS_ON);
  const blockedAds = options.blockAds === false ? () => 0 : await blockAds(context);
  const analytics = createGa4Recorder();
  context.on('request', (request) => analytics.record(request.url(), request.postData()));
  let page = await context.newPage();
  options.tap?.page(page);
  context.on('page', (opened) => {
    page = opened;
    options.tap?.page(opened);
  });

  const vars = {
    runNr: options.runNr,
    botNr: options.botNr,
    faker: createTestData(options.runNr, options.botNr),
    secrets: options.secrets,
  };
  const mask = (text: string) => maskSecrets(text, secrets);
  /** Whether a picture of the page may be kept: no secret in the clear, also right after it. */
  const showable = async () => !(await exposesSecret(page, secrets));

  const result: RunResult = {
    status: 'passed',
    steps: [],
    extracted: {},
    screenshots: [],
    analyticsEvents: [],
    blockedAdRequests: 0,
  };

  for (const [index, step] of flow.steps.entries()) {
    if (result.status === 'failed' || result.status === 'not_passed') {
      result.steps.push({ stepId: step.id, index, status: 'skipped', durationMs: 0 });
      continue;
    }

    const started = performance.now();
    const duration = () => Math.ceil(performance.now() - started);
    options.tap?.step(index, 'running');
    const ctx = { vars, baseUrl: options.baseUrl, analytics };
    try {
      if (step.type === 'ai') {
        const judged = await runAiStep(() => page, step, { ...ctx, drive: options.ai, mask });
        const first = (status: Criterion['status']) =>
          judged.criteria.find((criterion) => criterion.status === status);
        const failed = first('failed');
        const unknown = first('unknown');
        result.steps.push({
          stepId: step.id,
          index,
          status: judged.outcome,
          durationMs: duration(),
          ...(failed
            ? { message: `Nicht erfüllt: ${failed.goal} ${failed.evidence}` }
            : unknown
              ? { message: `Nicht prüfbar: ${unknown.goal} ${unknown.evidence}` }
              : {}),
          aiActions: judged.actions,
          aiVerdict: judged.criteria,
        });
        if (judged.screenshot)
          result.screenshots.push({ stepId: step.id, image: judged.screenshot });
        if (judged.outcome === 'failed') result.status = 'not_passed';
        if (judged.outcome === 'unclear' && result.status === 'passed') result.status = 'warning';
        options.tap?.step(index, judged.outcome);
        continue;
      }
      const outcome = await executeStep(() => page, step, ctx);
      if (step.type === 'extract' && outcome.extracted !== undefined) {
        result.extracted[step.saveAs] = mask(outcome.extracted);
      }
      const kept = outcome.screenshot && (await showable()) ? outcome.screenshot : null;
      if (kept) result.screenshots.push({ stepId: step.id, image: kept });
      result.steps.push({
        stepId: step.id,
        index,
        status: 'passed',
        durationMs: duration(),
        ...(outcome.screenshot && !kept ? { message: LEFT_OUT } : {}),
      });
      options.tap?.step(index, 'passed');
    } catch (error) {
      result.status = error instanceof ExpectationError ? 'not_passed' : 'failed';
      result.steps.push({
        stepId: step.id,
        index,
        status: 'failed',
        durationMs: duration(),
        message: mask(toStepMessage(error)),
        ...(error instanceof AiStepError ? { aiActions: error.actions } : {}),
      });
      options.tap?.step(index, 'failed');
      // Bounded: on a page that hangs, an unbounded screenshot would block the browser slot.
      await waitForPdf(page, FAILURE_SCREENSHOT_TIMEOUT_MS);
      const image = (await showable())
        ? await page.screenshot({ timeout: FAILURE_SCREENSHOT_TIMEOUT_MS }).catch(() => null)
        : null;
      if (image && (await showable())) result.screenshots.push({ stepId: step.id, image });
    }
  }

  result.analyticsEvents = analytics.events();
  result.blockedAdRequests = blockedAds();
  await Promise.all(context.pages().map((open) => open.close()));
  return result;
}
