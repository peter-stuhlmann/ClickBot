import { describe, expect, it } from 'vitest';
import { newStep, type StepDraft } from './job-draft';
import { STEP_TYPE_OPTIONS, describeStep } from './step-view';

function step(type: StepDraft['type'], overrides: Partial<StepDraft> = {}): StepDraft {
  return { ...newStep(type, [], ''), ...overrides };
}

describe('describeStep', () => {
  it.each([
    [
      step('open', { url: 'https://beispiel.de/kontakt' }),
      'Öffnen',
      'neutral',
      'Öffne beispiel.de/kontakt',
      'url = "https://beispiel.de/kontakt"',
    ],
    [
      step('click', { targetRole: 'button', targetValue: 'Absenden' }),
      'Klicken',
      'primary',
      'Klicke auf „Absenden“',
      'role = button, name = "Absenden"',
    ],
    [
      step('click', { targetRole: 'link', targetValue: '' }),
      'Klicken',
      'primary',
      'Klicke auf „link“',
      'role = link',
    ],
    [
      step('fill', { targetValue: 'E-Mail', value: '{{faker.email}}' }),
      'Ausfüllen',
      'info',
      'Fülle „E-Mail“ aus',
      'label = "E-Mail" → "{{faker.email}}"',
    ],
    [
      step('select', { targetBy: 'css', targetValue: '#land', value: 'Österreich' }),
      'Auswählen',
      'info',
      'Wähle „Österreich“ in „#land“',
      'css = "#land" → "Österreich"',
    ],
    [
      step('assert', { value: 'Vielen Dank' }),
      'Prüfen',
      'success',
      'Prüfe: „Vielen Dank“ ist sichtbar',
      'expect text "Vielen Dank"',
    ],
    [
      step('assert', { assertKind: 'urlContains', value: '/danke' }),
      'Prüfen',
      'success',
      'Prüfe: Adresse enthält „/danke“',
      'expect url contains "/danke"',
    ],
    [
      step('assert', { assertKind: 'titleContains', value: 'Danke' }),
      'Prüfen',
      'success',
      'Prüfe: Seitentitel enthält „Danke“',
      'expect title contains "Danke"',
    ],
    [
      step('assert', { assertKind: 'elementVisible', targetBy: 'testId', targetValue: 'ok' }),
      'Prüfen',
      'success',
      'Prüfe: „ok“ ist sichtbar',
      'testId = "ok"',
    ],
    [step('wait', { waitSeconds: '1,5' }), 'Warten', 'neutral', 'Warte 1,5 s', 'duration = 1,5 s'],
    [
      step('wait', { waitKind: 'element', targetBy: 'text', targetValue: 'Fertig' }),
      'Warten',
      'neutral',
      'Warte auf „Fertig“',
      'text = "Fertig"',
    ],
    [
      step('wait', { waitKind: 'networkIdle' }),
      'Warten',
      'neutral',
      'Warte, bis die Seite nichts mehr lädt',
      'network idle',
    ],
    [
      step('screenshot', { value: 'Danke-Seite', fullPage: true }),
      'Screenshot',
      'neutral',
      'Bildschirmfoto „Danke-Seite“',
      'ganze Seite',
    ],
    [step('screenshot'), 'Screenshot', 'neutral', 'Bildschirmfoto', 'sichtbarer Bereich'],
    [
      step('analytics', { value: 'form_submit' }),
      'Analytics',
      'warning',
      'GA4-Event „form_submit“',
      'ga4 event = "form_submit"',
    ],
  ])('describes %o', (input, typeLabel, tone, title, detail) => {
    expect(describeStep(input)).toEqual({ typeLabel, tone, title, detail });
  });

  it('shows an ellipsis for fields that are still empty', () => {
    expect(describeStep(step('open'))).toMatchObject({ title: 'Öffne …', detail: 'url = ""' });
    expect(describeStep(step('fill'))).toMatchObject({ title: 'Fülle „…“ aus' });
  });
});

describe('STEP_TYPE_OPTIONS', () => {
  it('offers every step type the worker can run, but no AI or code steps yet', () => {
    expect(STEP_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'open',
      'click',
      'fill',
      'select',
      'assert',
      'wait',
      'screenshot',
      'analytics',
    ]);
  });
});
