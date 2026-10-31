import { flowSchema, type Flow, type Step, type StepType } from './flow';

/**
 * Templates ("Vorlagen") are flows for any website: the steps of the step forms, without the
 * opening of the start page (every job opens its own) and without password protection, which
 * belongs to one website. Pages of the website are paths, which the worker resolves against the
 * job's start URL.
 */

/** Step types a template may hold: those the step forms can edit, except password protection. */
export const TEMPLATE_STEP_TYPES = [
  'open',
  'click',
  'fill',
  'select',
  'press',
  'scroll',
  'assert',
  'wait',
  'screenshot',
  'analytics',
  'ai',
] as const satisfies readonly StepType[];

const allowed = (step: Step) => (TEMPLATE_STEP_TYPES as readonly StepType[]).includes(step.type);

export const templateFlowSchema = flowSchema.superRefine((flow, ctx) => {
  flow.steps.forEach((step, index) => {
    if (allowed(step)) return;
    ctx.addIssue({
      code: 'custom',
      path: ['steps', index, 'type'],
      message:
        step.type === 'basicAuth'
          ? 'Passwortschutz gehört zu einer Website und nicht in eine Vorlage.'
          : 'Diesen Schritt-Typ gibt es in Vorlagen noch nicht.',
    });
  });
});

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** The flow of a job as a template; see above. */
export function toTemplateFlow(flow: Flow, startUrl: string): Flow {
  const start = parse(startUrl);
  const asPath = (url: string) => {
    const page = parse(url);
    return start && page && page.origin === start.origin
      ? `${page.pathname}${page.search}${page.hash}`
      : url;
  };
  const steps = flow.steps.filter(allowed);
  const [first] = steps;
  const opensStart = start && first?.type === 'open' && parse(first.url)?.href === start.href;
  return {
    version: 1,
    steps: (opensStart ? steps.slice(1) : steps).map((step) =>
      step.type === 'open' ? { ...step, url: asPath(step.url) } : step,
    ),
  };
}
