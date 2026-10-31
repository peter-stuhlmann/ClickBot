import type { AgentAction, AgentInput } from '@click-bot/ai';
import type { Step } from '@click-bot/shared';
import { StepError, toStepMessage } from './errors';
import { readStructure } from './page-analysis';
import { executeStep, type StepContext } from './steps';
import { describeTarget, pageOf, type PageSource } from './targets';

/** Asks the AI for the next action; the worker builds it from the default provider. */
export type AgentDriver = (input: AgentInput) => Promise<AgentAction>;

/** Enough for a form over a few pages; a loop beyond it costs money and proves nothing. */
export const MAX_AI_ACTIONS = 20;
/** An action of the AI waits at most this long for its element. */
const ACTION_TIMEOUT_MS = 10_000;
const NOT_ON_SITE = 'nicht erlaubt: nur Seiten der getesteten Website';

type AiStep = Extract<Step, { type: 'ai' }>;

/** Fails an AI step and keeps what the AI did, for the report. */
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

/**
 * Runs an AI step: looks at the page, asks the AI for one action, carries it out like a step of
 * the flow and tells the AI how it went, until the AI says it is done or gives up. Returns one
 * line per action for the report; throws AiStepError with those lines when the step fails.
 */
export async function runAiStep(
  current: PageSource,
  step: AiStep,
  ctx: AiStepContext,
): Promise<{ actions: string[] }> {
  const { drive, mask } = ctx;
  if (!drive) {
    throw new AiStepError(
      'Kein KI-Anbieter eingerichtet: unter „Einstellungen → KI & API“ einen speichern.',
      [],
    );
  }
  const actions: string[] = [];
  const history: AgentInput['history'] = [];

  for (let count = 0; count < MAX_AI_ACTIONS; count += 1) {
    const page = pageOf(current);
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
        },
        history,
      });
    } catch (error) {
      throw new AiStepError(`KI-Anbieter: ${mask(toStepMessage(error))}`, actions);
    }

    if (action.kind === 'done') {
      actions.push(`Fertig: ${mask(action.summary)}`);
      return { actions };
    }
    if (action.kind === 'fail') {
      actions.push(`Abgebrochen: ${mask(action.reason)}`);
      throw new AiStepError(`KI: ${mask(action.reason)}`, actions);
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
  throw new AiStepError(`KI-Schritt nicht fertig nach ${MAX_AI_ACTIONS} Aktionen.`, actions);
}
