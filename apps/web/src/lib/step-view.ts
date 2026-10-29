import { displayUrl } from './format';
import type { AssertKind, EditableStepType, StepDraft, TargetBy, WaitKind } from './job-draft';
import type { StepItemView, StepTone } from './views';

type Option<T extends string> = { value: T; label: string };

export const STEP_TYPE_OPTIONS: readonly Option<EditableStepType>[] = [
  { value: 'open', label: 'Seite öffnen' },
  { value: 'click', label: 'Klicken' },
  { value: 'fill', label: 'Ausfüllen' },
  { value: 'select', label: 'Auswählen' },
  { value: 'assert', label: 'Prüfen' },
  { value: 'wait', label: 'Warten' },
  { value: 'screenshot', label: 'Bildschirmfoto' },
  { value: 'analytics', label: 'Analytics-Event prüfen' },
  { value: 'basicAuth', label: 'Passwortschutz (.htaccess)' },
];

export const TARGET_OPTIONS: readonly Option<TargetBy>[] = [
  { value: 'role', label: 'Rolle und Name' },
  { value: 'label', label: 'Label' },
  { value: 'text', label: 'Text' },
  { value: 'css', label: 'CSS-Selektor' },
  { value: 'testId', label: 'Test-ID' },
];

export const ROLE_OPTIONS: readonly Option<string>[] = [
  { value: 'button', label: 'Button' },
  { value: 'link', label: 'Link' },
  { value: 'textbox', label: 'Textfeld' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio-Button' },
  { value: 'combobox', label: 'Auswahlliste' },
  { value: 'heading', label: 'Überschrift' },
  { value: 'tab', label: 'Tab' },
  { value: 'menuitem', label: 'Menüeintrag' },
];

export const ASSERT_OPTIONS: readonly Option<AssertKind>[] = [
  { value: 'textVisible', label: 'Text ist sichtbar' },
  { value: 'elementVisible', label: 'Element ist sichtbar' },
  { value: 'urlContains', label: 'Adresse enthält' },
  { value: 'titleContains', label: 'Seitentitel enthält' },
];

export const WAIT_OPTIONS: readonly Option<WaitKind>[] = [
  { value: 'duration', label: 'Feste Zeit' },
  { value: 'element', label: 'Bis ein Element erscheint' },
  { value: 'networkIdle', label: 'Bis die Seite nichts mehr lädt' },
];

const TYPE_BADGE: Record<EditableStepType, { typeLabel: string; tone: StepTone }> = {
  open: { typeLabel: 'Öffnen', tone: 'neutral' },
  click: { typeLabel: 'Klicken', tone: 'primary' },
  fill: { typeLabel: 'Ausfüllen', tone: 'info' },
  select: { typeLabel: 'Auswählen', tone: 'info' },
  assert: { typeLabel: 'Prüfen', tone: 'success' },
  wait: { typeLabel: 'Warten', tone: 'neutral' },
  screenshot: { typeLabel: 'Screenshot', tone: 'neutral' },
  analytics: { typeLabel: 'Analytics', tone: 'warning' },
  basicAuth: { typeLabel: 'Passwortschutz', tone: 'neutral' },
};

const EMPTY = '…';
const or = (value: string) => value.trim() || EMPTY;

/** What the step looks for, in words: the accessible name, label, text or selector. */
function targetName(step: StepDraft): string {
  const value = step.targetValue.trim();
  return step.targetBy === 'role' ? value || step.targetRole : or(value);
}

/** The locator in code style, e.g. `role = button, name = "Absenden"`. */
function targetDetail(step: StepDraft): string {
  const value = step.targetValue.trim();
  if (step.targetBy === 'role') {
    return value ? `role = ${step.targetRole}, name = "${value}"` : `role = ${step.targetRole}`;
  }
  return `${step.targetBy} = "${value}"`;
}

type Content = { title: string; detail: string };

function describeAssertion(step: StepDraft, value: string): Content {
  switch (step.assertKind) {
    case 'textVisible':
      return { title: `Prüfe: „${or(value)}“ ist sichtbar`, detail: `expect text "${value}"` };
    case 'urlContains':
      return {
        title: `Prüfe: Adresse enthält „${or(value)}“`,
        detail: `expect url contains "${value}"`,
      };
    case 'titleContains':
      return {
        title: `Prüfe: Seitentitel enthält „${or(value)}“`,
        detail: `expect title contains "${value}"`,
      };
    case 'elementVisible':
      return { title: `Prüfe: „${targetName(step)}“ ist sichtbar`, detail: targetDetail(step) };
  }
}

function describeWait(step: StepDraft): Content {
  switch (step.waitKind) {
    case 'duration':
      return {
        title: `Warte ${or(step.waitSeconds)} s`,
        detail: `duration = ${step.waitSeconds.trim()} s`,
      };
    case 'element':
      return { title: `Warte auf „${targetName(step)}“`, detail: targetDetail(step) };
    case 'networkIdle':
      return { title: 'Warte, bis die Seite nichts mehr lädt', detail: 'network idle' };
  }
}

function describeContent(step: StepDraft): Content {
  const value = step.value.trim();
  switch (step.type) {
    case 'open':
      return {
        title: `Öffne ${step.url.trim() ? displayUrl(step.url.trim()) : EMPTY}`,
        detail: `url = "${step.url.trim()}"`,
      };
    case 'click':
      return { title: `Klicke auf „${targetName(step)}“`, detail: targetDetail(step) };
    case 'fill':
      return {
        title: `Fülle „${targetName(step)}“ aus`,
        detail: `${targetDetail(step)} → "${step.value}"`,
      };
    case 'select':
      return {
        title: `Wähle „${or(value)}“ in „${targetName(step)}“`,
        detail: `${targetDetail(step)} → "${value}"`,
      };
    case 'assert':
      return describeAssertion(step, value);
    case 'wait':
      return describeWait(step);
    case 'screenshot':
      return {
        title: value ? `Bildschirmfoto „${value}“` : 'Bildschirmfoto',
        detail: step.fullPage ? 'ganze Seite' : 'sichtbarer Bereich',
      };
    case 'analytics':
      return { title: `GA4-Event „${or(value)}“`, detail: `ga4 event = "${value}"` };
    case 'basicAuth': {
      // Never the password itself, not even its length.
      const user = step.username.trim();
      const hasPassword = step.password !== '' || step.storedPassword !== '';
      return {
        title: `Passwortschutz als „${or(user)}“`,
        detail: `basic auth, user = "${user}", ${hasPassword ? 'password = ••••••' : 'password fehlt'}`,
      };
    }
  }
}

/** Badge, title and code-style detail line of a step in the step list. */
export function describeStep(step: StepDraft): StepItemView {
  return { ...TYPE_BADGE[step.type], ...describeContent(step) };
}
