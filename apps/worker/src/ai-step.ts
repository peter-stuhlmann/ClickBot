import type { AgentAction, AgentInput } from '@click-bot/ai';
import { verdictOutcome, type Criterion, type Step, type VerdictOutcome } from '@click-bot/shared';
import type { Page } from 'playwright';
import { StepError, toStepMessage } from './errors';
import { readStructure } from './page-analysis';
import { executeStep, type StepContext } from './steps';
import { describeTarget, pageOf, type PageSource } from './targets';

/** Asks the AI for the next action or its verdict; the worker builds it from the default provider. */
export type AgentDriver = (input: AgentInput) => Promise<AgentAction>;

/** Enough to find a way over a few pages; a loop beyond it costs money and proves nothing. */
export const MAX_AI_ACTIONS = 25;
/** An action of the AI waits at most this long for its element. */
const ACTION_TIMEOUT_MS = 10_000;
const SCREENSHOT_TIMEOUT_MS = 5_000;
const NOT_ON_SITE = 'nicht erlaubt: nur Seiten der getesteten Website';

type AiStep = Extract<Step, { type: 'ai' }>;

/** Fails an AI step that could not be judged, and keeps what the AI did, for the report. */
export class AiStepError extends StepError {
  constructor(
    message: string,
    readonly actions: string[],
  ) {
    super(message);
  }
}

export type AiStepContext = StepContext & {
  drive?: AgentDriver;
  /** Replaces secret values in everything the AI or the report sees. */
  mask: (text: string) => string;
};

export type AiStepResult = {
  outcome: VerdictOutcome;
  criteria: Criterion[];
  actions: string[];
  /** The page as the AI judged it, for the report; none while a secret is on the page. */
  screenshot: Buffer | null;
};

const DIRECTIONS = { down: 'unten', up: 'oben', right: 'rechts', left: 'links' } as const;
const EDGES = {
  top: 'an den Seitenanfang',
  bottom: 'ans Seitenende',
  left: 'an den linken Rand',
  right: 'an den rechten Rand',
} as const;

/** One German line per action, for the report. */
function describeAction(step: Step): string {
  switch (step.type) {
    case 'click':
      return `Klick auf ${describeTarget(step.target)}`;
    case 'fill':
      return `${describeTarget(step.target)} ausgefüllt mit „${step.value}“`;
    case 'select':
      return `${describeTarget(step.target)} auf „${step.option}“ gesetzt`;
    case 'press':
      return step.target
        ? `Taste ${step.key} auf ${describeTarget(step.target)}`
        : `Taste ${step.key}`;
    case 'scroll': {
      const { to } = step;
      if (to.kind === 'element') return `Gescrollt zu ${describeTarget(to.target)}`;
      if (to.kind === 'by') return `${to.distance} px nach ${DIRECTIONS[to.direction]} gescrollt`;
      if (to.kind === 'position') return `Gescrollt zu ${to.y} px von oben`;
      return `Gescrollt ${EDGES[to.kind]}`;
    }
    case 'open':
      return `Seite ${step.url} geöffnet`;
    case 'wait':
      return step.until.kind === 'duration'
        ? `${step.until.ms} ms gewartet`
        : step.until.kind === 'element'
          ? `Gewartet auf ${describeTarget(step.until.target)}`
          : 'Gewartet, bis die Seite nichts mehr lädt';
    default:
      return step.type;
  }
}

/** Without the leading "www.", so www.beispiel.de and beispiel.de are the same website. */
const siteOf = (url: URL) => url.hostname.replace(/^www\./, '');

function onSite(target: string, baseUrl: string): boolean {
  try {
    return siteOf(new URL(target, baseUrl)) === siteOf(new URL(baseUrl));
  } catch {
    return false;
  }
}

/** Whether a secret value is anywhere on the page: in its address, its text or a field. */
async function showsSecret(page: Page, secrets: string[]): Promise<boolean> {
  const values = secrets.filter(Boolean);
  if (values.length === 0) return false;
  if (values.some((value) => page.url().includes(value))) return true;
  for (const frame of page.frames()) {
    const found = await frame
      .evaluate((list) => {
        const fields = [...document.querySelectorAll('input, textarea')].map(
          (field) => (field as HTMLInputElement).value,
        );
        const text = [document.body?.innerText ?? '', ...fields].join('\n');
        return list.some((value) => text.includes(value));
      }, values)
      // A frame that cannot be read might show anything: no screenshot then.
      .catch(() => true);
    if (found) return true;
  }
  return false;
}

/** A screenshot of the visible part, or null while it could show a secret or does not come. */
async function safeScreenshot(page: Page, secrets: string[], type: 'jpeg' | 'png') {
  if (await showsSecret(page, secrets)) return null;
  return page
    .screenshot({
      type,
      ...(type === 'jpeg' ? { quality: 60 } : {}),
      timeout: SCREENSHOT_TIMEOUT_MS,
    })
    .catch(() => null);
}

/**
 * Runs an AI step: the AI gets the goal of the test, looks at the page (structure and screenshot),
 * and either sends one action, which runs like a step of the flow, or its verdict per sub-goal.
 * After MAX_AI_ACTIONS actions it has to judge. Throws AiStepError when no verdict comes.
 */
export async function runAiStep(
  current: PageSource,
  step: AiStep,
  ctx: AiStepContext,
): Promise<AiStepResult> {
  const { drive, mask } = ctx;
  if (!drive) {
    throw new AiStepError(
      'Kein KI-Anbieter eingerichtet: unter „Einstellungen → KI & API“ einen speichern.',
      [],
    );
  }
  const secrets = Object.values(ctx.vars.secrets);
  const actions: string[] = [];
  const history: AgentInput['history'] = [];

  for (let count = 0; ; count += 1) {
    const page = pageOf(current);
    const image = await safeScreenshot(page, secrets, 'jpeg');
    let action: AgentAction;
    try {
      action = await drive({
        instruction: step.instruction,
        startUrl: ctx.baseUrl,
        secretNames: Object.keys(ctx.vars.secrets),
        page: {
          // Addresses can carry form values, e.g. ?name=… after a form sent by GET.
          url: mask(page.url()),
          title: mask(await page.title().catch(() => '')),
          snapshot: mask(await readStructure(page)),
          ...(image
            ? { screenshot: { mediaType: 'image/jpeg', data: image.toString('base64') } }
            : {}),
        },
        history,
        final: count >= MAX_AI_ACTIONS,
      });
    } catch (error) {
      throw new AiStepError(`KI-Anbieter: ${mask(toStepMessage(error))}`, actions);
    }

    if (action.kind === 'verdict') {
      const criteria = action.criteria.map((criterion) => ({
        goal: mask(criterion.goal),
        status: criterion.status,
        evidence: mask(criterion.evidence),
      }));
      return {
        outcome: verdictOutcome(criteria),
        criteria,
        actions,
        screenshot: await safeScreenshot(pageOf(current), secrets, 'png'),
      };
    }

    if (count >= MAX_AI_ACTIONS) {
      throw new AiStepError(
        `Die KI hat nach ${MAX_AI_ACTIONS} Aktionen keine Bewertung geliefert.`,
        actions,
      );
    }
    const { id: _id, timeoutMs, aiFallback: _fallback, ...shown } = action.step;
    let result = 'ok';
    if (action.step.type === 'open' && !onSite(action.step.url, ctx.baseUrl)) {
      result = NOT_ON_SITE;
    } else {
      try {
        const limited = { ...action.step, timeoutMs: Math.min(timeoutMs, ACTION_TIMEOUT_MS) };
        await executeStep(current, limited, ctx);
      } catch (error) {
        result = mask(toStepMessage(error));
      }
    }
    history.push({ action: shown, result });
    actions.push(`${mask(describeAction(action.step))}: ${result}`);
  }
}
