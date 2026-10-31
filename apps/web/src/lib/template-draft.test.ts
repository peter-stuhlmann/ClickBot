import type { Flow } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { newStep } from './job-draft';
import {
  appendTemplateStep,
  emptyTemplateDraft,
  stepsFromTemplate,
  templateToDraft,
  toTemplateInput,
  validateTemplate,
} from './template-draft';

const flow: Flow = {
  version: 1,
  steps: [
    { id: 'kontakt', type: 'open', url: '/kontakt', timeoutMs: 10_000, aiFallback: true },
    {
      id: 'senden',
      type: 'click',
      target: { by: 'role', role: 'button', name: 'Absenden' },
      timeoutMs: 10_000,
      aiFallback: true,
    },
  ],
};

describe('template drafts', () => {
  it('starts empty and adds a click first, because the job opens its own start page', () => {
    const draft = emptyTemplateDraft();
    expect(draft).toEqual({ name: '', description: '', steps: [] });
    const { steps, selected } = appendTemplateStep(draft.steps);
    expect(steps.map((step) => step.type)).toEqual(['click']);
    expect(selected).toBe(0);
    expect(appendTemplateStep(steps).steps.map((step) => step.id)).toEqual(['click-1', 'click-2']);
  });

  it('turns a stored template into form fields and back', () => {
    const draft = templateToDraft({ name: 'Kontakt', description: null, flow });
    expect(draft.description).toBe('');
    expect(draft.steps.map((step) => [step.type, step.url || step.targetValue])).toEqual([
      ['open', '/kontakt'],
      ['click', 'Absenden'],
    ]);
    expect(toTemplateInput({ ...draft, name: ' Kontakt ', description: ' Formular ' })).toEqual({
      name: 'Kontakt',
      description: 'Formular',
      flow: {
        version: 1,
        steps: [
          { id: 'kontakt', type: 'open', url: '/kontakt', timeoutMs: 10_000 },
          {
            id: 'senden',
            type: 'click',
            target: { by: 'role', role: 'button', name: 'Absenden' },
            timeoutMs: 10_000,
          },
        ],
      },
    });
  });

  it('reports what keeps a template from being saved, by field and step', () => {
    expect(validateTemplate({ name: ' ', description: '', steps: [] })).toEqual([
      { path: 'name', message: 'Name fehlt.' },
      { path: 'flow.steps', message: 'Der Ablauf braucht mindestens einen Schritt.' },
    ]);
    const open = { ...newStep('open', [], ''), url: 'kontakt' };
    expect(validateTemplate({ name: 'Kontakt', description: '', steps: [open] })).toEqual([
      { path: 'flow.steps.0.url', message: 'Adresse muss mit http://, https:// oder / beginnen.' },
    ]);
    const login = { ...newStep('basicAuth', [], ''), username: 'team', password: 'geheim' };
    expect(validateTemplate({ name: 'Kontakt', description: '', steps: [login] })).toEqual([
      {
        path: 'flow.steps.0.type',
        message: 'Passwortschutz gehört zu einer Website und nicht in eine Vorlage.',
      },
    ]);
  });
});

describe('stepsFromTemplate', () => {
  it('opens the start page first, which the template leaves to the job', () => {
    const steps = stepsFromTemplate(
      { version: 1, steps: [flow.steps[1] as Flow['steps'][number]] },
      'beispiel.de',
    );
    expect(steps.map((step) => [step.id, step.type, step.url])).toEqual([
      ['open-1', 'open', 'https://beispiel.de'],
      ['senden', 'click', ''],
    ]);
  });

  it('keeps a template that opens a page itself as it is', () => {
    const steps = stepsFromTemplate(flow, 'https://beispiel.de');
    expect(steps.map((step) => [step.type, step.url])).toEqual([
      ['open', '/kontakt'],
      ['click', ''],
    ]);
  });
});
