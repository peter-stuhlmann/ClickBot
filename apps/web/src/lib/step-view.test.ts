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
  it('offers every step type the worker can run, but no reading out or code', () => {
    expect(STEP_TYPE_OPTIONS.map((option) => option.value)).toEqual([
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
    ]);
  });
});

describe('describeStep for .htaccess steps', () => {
  it('names the user but never shows the password', () => {
    const described = describeStep(
      step('basicAuth', { username: 'kunde', password: 'geheim-123' }),
    );
    expect(described).toEqual({
      typeLabel: 'Passwortschutz',
      tone: 'neutral',
      title: 'Passwortschutz als „kunde“',
      detail: 'basic auth, user = "kunde", password = ••••••',
    });
    expect(JSON.stringify(described)).not.toContain('geheim');
  });

  it('shows the password as missing until one is typed or stored', () => {
    expect(describeStep(step('basicAuth', { username: 'kunde' })).detail).toBe(
      'basic auth, user = "kunde", password fehlt',
    );
    expect(
      describeStep(step('basicAuth', { storedPassword: '{{secret.htaccess-beispiel-de}}' })).detail,
    ).toBe('basic auth, user = "", password = ••••••');
  });
});

describe('describeStep for AI steps', () => {
  it('shows the task of the AI', () => {
    expect(describeStep(step('ai', { value: '  Schick das Kontaktformular ab.  ' }))).toEqual({
      typeLabel: 'KI',
      tone: 'primary',
      title: 'Schick das Kontaktformular ab.',
      detail: 'Frei: Die KI sucht den Weg und bewertet das Ziel.',
    });
  });
});

describe('describeStep for scrolling and keys', () => {
  it.each([
    [{ scrollKind: 'position', scrollY: '1200' }, 'Scrolle zu 1200 px von oben', 'scroll y = 1200'],
    [
      { scrollKind: 'element', targetBy: 'role', targetRole: 'heading', targetValue: 'Kontakt' },
      'Scrolle zu „Kontakt“',
      'role = heading, name = "Kontakt"',
    ],
    [
      { scrollKind: 'position', scrollY: '0', scrollX: '300' },
      'Scrolle zu 0 px von oben, 300 px von links',
      'scroll y = 0, x = 300',
    ],
    [
      { scrollKind: 'by', scrollDirection: 'down', scrollDistance: '500' },
      'Scrolle 500 px nach unten',
      'scroll down by 500',
    ],
    [
      { scrollKind: 'by', scrollDirection: 'left', scrollDistance: '80' },
      'Scrolle 80 px nach links',
      'scroll left by 80',
    ],
    [{ scrollKind: 'edge', scrollDirection: 'down' }, 'Scrolle ans Seitenende', 'scroll bottom'],
    [{ scrollKind: 'edge', scrollDirection: 'up' }, 'Scrolle an den Seitenanfang', 'scroll top'],
    [
      { scrollKind: 'edge', scrollDirection: 'right' },
      'Scrolle an den rechten Rand',
      'scroll right',
    ],
    [{ scrollKind: 'edge', scrollDirection: 'left' }, 'Scrolle an den linken Rand', 'scroll left'],
  ] as const)('names a scroll step: %o', (fields, title, detail) => {
    expect(describeStep(step('scroll', fields))).toMatchObject({
      typeLabel: 'Scrollen',
      title,
      detail,
    });
  });

  it('names a key, alone or on an element', () => {
    expect(describeStep(step('press', { key: 'Escape' }))).toMatchObject({
      typeLabel: 'Taste',
      title: 'Drücke Escape',
      detail: 'key = "Escape"',
    });
    expect(
      describeStep(
        step('press', {
          key: 'Control+a',
          pressOnElement: true,
          targetBy: 'label',
          targetValue: 'Suche',
        }),
      ),
    ).toMatchObject({
      title: 'Drücke Control+a in „Suche“',
      detail: 'key = "Control+a", label = "Suche"',
    });
  });
});
