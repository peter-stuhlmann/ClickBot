import { describe, expect, it } from 'vitest';
import { emptyDraft, newStep, type StepDraft } from './job-draft';
import { restoreWizardState, storableState, type WizardState } from './wizard-state';

const now = new Date('2026-11-02T10:00:00Z');

function htaccess(password: string, storedPassword = ''): StepDraft {
  return { ...newStep('basicAuth', [], ''), username: 'kunde', password, storedPassword };
}

function state(overrides: Partial<WizardState> = {}): WizardState {
  const open = newStep('open', [], 'https://beispiel.de');
  return {
    version: 1,
    draft: { ...emptyDraft(now), startUrl: 'beispiel.de', steps: [open] },
    method: 'fixed',
    goal: '',
    fixedSteps: [],
    current: 0,
    ...overrides,
  };
}

describe('storableState', () => {
  it('keeps no typed password, only the reference to the encrypted secret', () => {
    const typed = { ...htaccess('geheim'), id: 'basicAuth-1' };
    const secured = {
      version: 1,
      steps: [
        { id: 'basicAuth-1', type: 'basicAuth', password: '{{secret.htaccess-beispiel.de}}' },
      ],
    };
    const stored = storableState(
      state({ draft: { ...emptyDraft(now), steps: [typed] }, fixedSteps: [htaccess('alt')] }),
      secured,
    );

    expect(stored.draft.steps[0]).toMatchObject({
      password: '',
      storedPassword: '{{secret.htaccess-beispiel.de}}',
    });
    // Steps kept aside for the other mode lose a typed password; it was never stored.
    expect(stored.fixedSteps[0]).toMatchObject({ password: '', storedPassword: '' });
    expect(JSON.stringify(stored)).not.toContain('geheim');
  });

  it('keeps a password reference that was already stored', () => {
    const kept = htaccess('', '{{secret.htaccess-beispiel.de}}');
    const stored = storableState(state({ draft: { ...emptyDraft(now), steps: [kept] } }), null);
    expect(stored.draft.steps[0]?.storedPassword).toBe('{{secret.htaccess-beispiel.de}}');
  });
});

describe('restoreWizardState', () => {
  it('brings back what was stored', () => {
    const stored = state({ method: 'free', goal: 'Newsletter', current: 1 });
    expect(restoreWizardState(JSON.parse(JSON.stringify(stored)), now)).toEqual(stored);
  });

  it('fills in fields the form has gained since, and drops what does not fit', () => {
    const stored = state();
    const old = JSON.parse(JSON.stringify(stored)) as Record<string, unknown> & {
      draft: Record<string, unknown> & { schedule: Record<string, unknown> };
    };
    delete old.draft.blockAds;
    delete old.draft.schedule.stagger;
    old.draft.name = 42;
    old.current = 9;
    old.method = 'code';
    old.fixedSteps = [{ id: 'x', type: 'unknown' }, 'kaputt', { type: 'click' }];

    expect(restoreWizardState(old, now)).toEqual({
      ...stored,
      draft: { ...stored.draft, name: '', blockAds: true },
      fixedSteps: [],
    });
  });

  it('completes a stored step with the defaults of its type', () => {
    const restored = restoreWizardState(
      { ...state(), draft: { steps: [{ id: 'click-3', type: 'click', targetValue: 'Kurse' }] } },
      now,
    );
    expect(restored?.draft.steps).toEqual([
      { ...newStep('click', [], ''), id: 'click-3', targetValue: 'Kurse' },
    ]);
  });

  it.each([null, 'text', [], { version: 2 }, { version: 1 }])(
    'starts afresh from something that is no stored form: %j',
    (value) => {
      expect(restoreWizardState(value, now)).toBeNull();
    },
  );
});
