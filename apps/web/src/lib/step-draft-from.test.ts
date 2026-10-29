import { stepSchema, type Step } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { emptyDraft, toNewJobInput, toStepDraft } from './job-draft';

const base = { timeoutMs: 10_000, aiFallback: true };

// Steps as stored in a job: parsed by flowSchema, defaults filled in.
const STORED: Step[] = [
  { ...base, id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' },
  { ...base, id: 'c', type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
  { ...base, id: 'c2', type: 'click', target: { by: 'role', role: 'link' } },
  {
    ...base,
    id: 'f',
    type: 'fill',
    target: { by: 'label', label: 'E-Mail' },
    value: '{{faker.email}}',
  },
  {
    ...base,
    id: 's',
    type: 'select',
    target: { by: 'css', selector: '#land' },
    option: 'Österreich',
  },
  { ...base, id: 'a', type: 'assert', assertion: { kind: 'textVisible', text: 'Vielen Dank' } },
  { ...base, id: 'a2', type: 'assert', assertion: { kind: 'urlContains', value: '/danke' } },
  { ...base, id: 'a3', type: 'assert', assertion: { kind: 'titleContains', value: 'Danke' } },
  {
    ...base,
    id: 'a4',
    type: 'assert',
    assertion: { kind: 'elementVisible', target: { by: 'testId', testId: 'ok' } },
  },
  { ...base, id: 'w', type: 'wait', until: { kind: 'duration', ms: 1_500 } },
  {
    ...base,
    id: 'w2',
    type: 'wait',
    until: { kind: 'element', target: { by: 'text', text: 'Fertig', exact: false } },
  },
  { ...base, id: 'w3', type: 'wait', until: { kind: 'networkIdle' } },
  { ...base, id: 'sh', type: 'screenshot', name: 'Danke-Seite', fullPage: true },
  { ...base, id: 'sh2', type: 'screenshot', fullPage: false },
  { ...base, id: 'g', type: 'analytics', provider: 'ga4', event: 'form_submit' },
  {
    ...base,
    id: 't',
    type: 'click',
    target: { by: 'text', text: 'Mehr', exact: false },
    timeoutMs: 2_500,
  },
  {
    ...base,
    id: 'auth',
    type: 'basicAuth',
    username: 'kunde',
    password: '{{secret.htaccess-beispiel-de}}',
  },
];

describe('toStepDraft', () => {
  it.each(STORED.map((step) => [step.id, step] as const))(
    'turns stored step %s into a form and back without losing anything',
    (_id, step) => {
      const draft = toStepDraft(step);
      expect(draft).not.toBeNull();
      const [rebuilt] = toNewJobInput(
        { ...emptyDraft(new Date()), steps: [draft as NonNullable<typeof draft>] },
        new Date(),
      ).flow.steps;
      // The schema fills in the defaults (aiFallback, exact) exactly as when the job was saved.
      expect(stepSchema.parse(rebuilt)).toEqual(step);
    },
  );

  it('shows timeouts in seconds without thousands separators', () => {
    const step: Step = {
      ...base,
      id: 'c',
      type: 'click',
      target: { by: 'text', text: 'Los', exact: false },
      timeoutMs: 120_000,
    };
    expect(toStepDraft(step)?.timeoutSeconds).toBe('120');
  });

  it.each([
    { ...base, id: 'x', type: 'extract', target: { by: 'css', selector: '#nr' }, saveAs: 'nr' },
    { ...base, id: 'k', type: 'ai', instruction: 'Akzeptiere das Cookie-Banner.' },
  ] as Step[])('has no form for $type steps yet', (step) => {
    expect(toStepDraft(step)).toBeNull();
  });
});

describe('.htaccess steps in the form', () => {
  const stored: Step = {
    ...base,
    id: 'auth',
    type: 'basicAuth',
    username: 'kunde',
    password: '{{secret.htaccess-beispiel-de}}',
  };
  const rebuild = (draft: NonNullable<ReturnType<typeof toStepDraft>>) =>
    toNewJobInput({ ...emptyDraft(new Date()), steps: [draft] }, new Date()).flow.steps[0];

  it('never put the stored password into the password field', () => {
    expect(toStepDraft(stored)).toMatchObject({
      username: 'kunde',
      password: '',
      storedPassword: '{{secret.htaccess-beispiel-de}}',
    });
  });

  it('keep the stored password while the field stays empty', () => {
    const draft = toStepDraft(stored) as NonNullable<ReturnType<typeof toStepDraft>>;
    expect(rebuild(draft)).toMatchObject({ password: '{{secret.htaccess-beispiel-de}}' });
  });

  it('send a newly typed password, which the server then stores encrypted', () => {
    const draft = toStepDraft(stored) as NonNullable<ReturnType<typeof toStepDraft>>;
    expect(rebuild({ ...draft, password: 'neu-123' })).toMatchObject({ password: 'neu-123' });
  });
});
