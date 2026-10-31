import { templateFlowSchema, type Flow } from '@click-bot/shared';
import {
  newStep,
  normaliseUrl,
  toStep,
  toStepDraft,
  type Issue,
  type StepDraft,
  type StepListState,
} from './job-draft';

/** The form of a template ("Vorlagen"): name, note and the steps of the step builder. */
export type TemplateDraft = { name: string; description: string; steps: StepDraft[] };

export function emptyTemplateDraft(): TemplateDraft {
  return { name: '', description: '', steps: [] };
}

/** Adds a click: the job opens its start page itself, so a template rarely starts with "open". */
export function appendTemplateStep(steps: StepDraft[]): StepListState {
  return { steps: [...steps, newStep('click', steps, '')], selected: steps.length };
}

/** A stored template as form fields. Templates hold only steps the forms can edit. */
export function templateToDraft(template: {
  name: string;
  description: string | null;
  flow: Flow;
}): TemplateDraft {
  return {
    name: template.name,
    description: template.description ?? '',
    steps: template.flow.steps.flatMap((step) => toStepDraft(step) ?? []),
  };
}

/** Input for createTemplate and updateTemplate. */
export function toTemplateInput(draft: TemplateDraft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    flow: { version: 1, steps: draft.steps.map(toStep) },
  };
}

/** What keeps the template from being saved; the server checks the same again. */
export function validateTemplate(draft: TemplateDraft): Issue[] {
  const issues: Issue[] = [];
  if (!draft.name.trim()) issues.push({ path: 'name', message: 'Name fehlt.' });
  const parsed = templateFlowSchema.safeParse(toTemplateInput(draft).flow);
  if (!parsed.success) {
    issues.push(
      ...parsed.error.issues.map((issue) => ({
        path: ['flow', ...issue.path.map(String)].join('.'),
        message: issue.message,
      })),
    );
  }
  return issues;
}

/**
 * The steps of a template for a new job: first the job's start page, unless the template opens
 * a page itself. Paths in the template resolve against the start URL when the job runs.
 */
export function stepsFromTemplate(flow: Flow, startUrl: string): StepDraft[] {
  const steps = flow.steps.flatMap((step) => toStepDraft(step) ?? []);
  if (steps[0]?.type === 'open') return steps;
  return [{ ...newStep('open', steps, startUrl), url: normaliseUrl(startUrl) }, ...steps];
}
