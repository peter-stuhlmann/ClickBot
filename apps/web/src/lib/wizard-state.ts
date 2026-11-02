import {
  emptyDraft,
  newStep,
  type EditableStepType,
  type StepDraft,
  type WizardDraft,
} from './job-draft';

/**
 * The form of the "Neuer Job" wizard as a draft keeps it (jobs.wizard_state), so a reload brings
 * it back exactly as it was left: also the mode not shown and the step of the wizard.
 */
export type WizardState = {
  version: 1;
  draft: WizardDraft;
  method: 'fixed' | 'free';
  /** The goal of a free test. */
  goal: string;
  /** The steps of the fixed flow, kept while the free mode is shown. */
  fixedSteps: StepDraft[];
  /** Index into WIZARD_STEPS. */
  current: number;
};

const EDITABLE_TYPES: readonly EditableStepType[] = [
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
  'basicAuth',
  'ai',
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const kindOf = (value: unknown) =>
  Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

/**
 * The defaults, with every stored value of the same kind taken over. A form that gained a field
 * since it was stored gets its default; a value that does not fit is dropped.
 */
function overlay<T extends object>(defaults: T, stored: unknown): T {
  if (!isObject(stored)) return defaults;
  const result = { ...defaults } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = stored[key];
    // A stored interval start may be null or a date.
    const fits =
      kindOf(value) === kindOf(fallback) || (key === 'storedStartAt' && kindOf(value) === 'string');
    if (fits) result[key] = value;
  }
  return result as T;
}

function restoreSteps(value: unknown): StepDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => {
    if (!isObject(step) || typeof step.id !== 'string') return [];
    const type = EDITABLE_TYPES.find((known) => known === step.type);
    return type ? [overlay(newStep(type, [], ''), step)] : [];
  });
}

/** The stored form, or null when there is none to go by (the wizard then starts afresh). */
export function restoreWizardState(value: unknown, now: Date): WizardState | null {
  if (!isObject(value) || value.version !== 1 || !isObject(value.draft)) return null;
  const defaults = emptyDraft(now);
  const draft = overlay(defaults, value.draft);
  const current = Number.isInteger(value.current) ? (value.current as number) : 0;
  return {
    version: 1,
    draft: {
      ...draft,
      schedule: overlay(defaults.schedule, value.draft.schedule),
      steps: restoreSteps(value.draft.steps),
    },
    method: value.method === 'free' ? 'free' : 'fixed',
    goal: typeof value.goal === 'string' ? value.goal : '',
    fixedSteps: restoreSteps(value.fixedSteps),
    current: current >= 0 && current <= 2 ? current : 0,
  };
}

const SECRET_REFERENCE = /^\{\{secret\.[^}]+\}\}$/;

/** Step id → `{{secret.…}}` of the password the server stored for it. */
function storedReferences(securedFlow: unknown): Map<string, string> {
  const steps = isObject(securedFlow) && Array.isArray(securedFlow.steps) ? securedFlow.steps : [];
  const references = new Map<string, string>();
  for (const step of steps) {
    if (isObject(step) && typeof step.id === 'string' && typeof step.password === 'string') {
      if (SECRET_REFERENCE.test(step.password)) references.set(step.id, step.password);
    }
  }
  return references;
}

/**
 * The form without a typed password: passwords are only stored encrypted, as a secret. A step
 * whose password went into a secret (`securedFlow`, the flow after secureStepPasswords) keeps
 * the reference to it, like in the editor; any other typed password is dropped.
 */
export function storableState(state: WizardState, securedFlow: unknown): WizardState {
  const withoutPasswords = (steps: StepDraft[], references: Map<string, string>) =>
    steps.map((step) =>
      step.password === ''
        ? step
        : { ...step, password: '', storedPassword: references.get(step.id) ?? step.storedPassword },
    );
  return {
    ...state,
    // The secured flow is made of these steps; the ones kept aside were never stored.
    draft: {
      ...state.draft,
      steps: withoutPasswords(state.draft.steps, storedReferences(securedFlow)),
    },
    fixedSteps: withoutPasswords(state.fixedSteps, new Map()),
  };
}
