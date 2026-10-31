import { unknownTagHint } from '@click-bot/shared';
import { Card } from '@/components/atoms/Card';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/molecules/Select';
import { Field } from '@/components/molecules/Field';
import {
  defaultTargetBy,
  type EditableStepType,
  type StepDraft,
  type StepField,
  type TargetBy,
} from '@/lib/job-draft';
import {
  ASSERT_OPTIONS,
  ROLE_OPTIONS,
  SCROLL_OPTIONS,
  STEP_TYPE_OPTIONS,
  TARGET_OPTIONS,
  WAIT_OPTIONS,
} from '@/lib/step-view';

export type StepFormProps = {
  /** 0-based position of the step; the title counts from 1. */
  index: number;
  step: StepDraft;
  errors: Partial<Record<StepField, string>>;
  onChange: (step: StepDraft) => void;
  /** The actions offered; all by default. Templates leave out password protection. */
  types?: readonly EditableStepType[];
};

const TARGET_VALUE_LABEL: Record<Exclude<TargetBy, 'role'>, string> = {
  label: 'Label',
  text: 'Text',
  css: 'CSS-Selektor',
  testId: 'Test-ID',
};

const VARIABLES_HINT =
  'Variablen: {{faker.email}}, {{faker.name}}, {{run_nr}}, {{bot_nr}}, {{secret.name}}';

/** Label and hint of the "value" field, or null if the step type has none. */
function valueField(step: StepDraft): { label: string; hint?: string; mono?: boolean } | null {
  switch (step.type) {
    case 'fill':
      return { label: 'Wert', hint: VARIABLES_HINT, mono: true };
    case 'select':
      return { label: 'Option', hint: 'Sichtbarer Text der Option.' };
    case 'assert':
      if (step.assertKind === 'textVisible') return { label: 'Text' };
      if (step.assertKind === 'urlContains') return { label: 'Adresse enthält', mono: true };
      if (step.assertKind === 'titleContains') return { label: 'Seitentitel enthält' };
      return null;
    case 'screenshot':
      return { label: 'Name (optional)', hint: 'Erscheint so im Report.' };
    case 'analytics':
      return {
        label: 'Event-Name',
        hint: 'Der Bot wartet, bis die Seite dieses GA4-Event sendet, z. B. form_submit.',
        mono: true,
      };
    default:
      return null;
  }
}

function needsTarget(step: StepDraft): boolean {
  return (
    step.type === 'click' ||
    step.type === 'fill' ||
    step.type === 'select' ||
    (step.type === 'assert' && step.assertKind === 'elementVisible') ||
    (step.type === 'wait' && step.waitKind === 'element') ||
    (step.type === 'press' && step.pressOnElement) ||
    (step.type === 'scroll' && step.scrollKind === 'element')
  );
}

/** Edits one step of the flow; which fields appear depends on the action. */
export function StepForm({ index, step, errors, onChange, types }: StepFormProps) {
  const set = (patch: Partial<StepDraft>) => onChange({ ...step, ...patch });
  // While no element is entered yet, follow the action with the suggested way to find it.
  const changeType = (type: EditableStepType) =>
    set(step.targetValue.trim() ? { type } : { type, targetBy: defaultTargetBy(type) });
  const value = valueField(step);
  const typeLabel = STEP_TYPE_OPTIONS.find((option) => option.value === step.type)?.label;
  // A word like „decline“ is an element name in CSS; most likely .decline or #decline was meant.
  const cssHint = step.targetBy === 'css' ? unknownTagHint(step.targetValue) : null;

  return (
    <Card title={`Schritt ${index + 1} bearbeiten`} description={typeLabel}>
      <Field id="step-type" label="Aktion">
        {(control) => (
          <Select
            {...control}
            options={
              types
                ? STEP_TYPE_OPTIONS.filter((option) => types.includes(option.value))
                : STEP_TYPE_OPTIONS
            }
            value={step.type}
            onChange={(type) => changeType(type as EditableStepType)}
          />
        )}
      </Field>

      {step.type === 'press' && (
        <>
          <Field
            id="step-key"
            label="Taste"
            hint="Z. B. Escape, Enter, Tab oder eine Kombination wie Control+a oder Shift+Tab."
            error={errors.key}
          >
            {(control) => (
              <Input
                {...control}
                mono
                placeholder="Escape"
                value={step.key}
                onChange={(event) => set({ key: event.target.value })}
              />
            )}
          </Field>
          <Checkbox
            label="Auf einem Element drücken (bekommt vorher den Fokus)"
            checked={step.pressOnElement}
            onChange={(event) => set({ pressOnElement: event.target.checked })}
          />
        </>
      )}

      {step.type === 'scroll' && (
        <>
          <Field id="step-scroll" label="Scrollen">
            {(control) => (
              <Select
                {...control}
                options={SCROLL_OPTIONS}
                value={step.scrollKind}
                onChange={(scrollKind) =>
                  set({ scrollKind: scrollKind as StepDraft['scrollKind'] })
                }
              />
            )}
          </Field>
          {step.scrollKind === 'position' && (
            <Field
              id="step-scroll-y"
              label="Pixel von oben"
              hint="Wie weit die Seite gescrollt ist; 0 ist ganz oben."
              error={errors.scrollY}
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  value={step.scrollY}
                  onChange={(event) => set({ scrollY: event.target.value })}
                />
              )}
            </Field>
          )}
        </>
      )}

      {step.type === 'open' && (
        <Field
          id="step-url"
          label="Adresse"
          hint="Absolut (https://…) oder relativ zur Start-URL, z. B. /kontakt"
          error={errors.url}
        >
          {(control) => (
            <Input
              {...control}
              mono
              value={step.url}
              onChange={(event) => set({ url: event.target.value })}
            />
          )}
        </Field>
      )}

      {step.type === 'basicAuth' && (
        <>
          <Field id="step-username" label="Benutzername" error={errors.username}>
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                value={step.username}
                onChange={(event) => set({ username: event.target.value })}
              />
            )}
          </Field>
          <Field
            id="step-password"
            label="Passwort"
            hint="Wird verschlüsselt als Zugangsdaten des Projekts gespeichert und erscheint nie im Report."
            error={errors.password}
          >
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="new-password"
                placeholder={
                  step.storedPassword ? 'Gespeichert – leer lassen, um es zu behalten' : undefined
                }
                value={step.password}
                onChange={(event) => set({ password: event.target.value })}
              />
            )}
          </Field>
        </>
      )}

      {step.type === 'assert' && (
        <Field id="step-assert" label="Prüfung">
          {(control) => (
            <Select
              {...control}
              options={ASSERT_OPTIONS}
              value={step.assertKind}
              onChange={(assertKind) => set({ assertKind: assertKind as StepDraft['assertKind'] })}
            />
          )}
        </Field>
      )}

      {step.type === 'wait' && (
        <Field id="step-wait" label="Warten auf">
          {(control) => (
            <Select
              {...control}
              options={WAIT_OPTIONS}
              value={step.waitKind}
              onChange={(waitKind) => set({ waitKind: waitKind as StepDraft['waitKind'] })}
            />
          )}
        </Field>
      )}

      {needsTarget(step) && (
        <>
          <Field id="step-target-by" label="Element finden über">
            {(control) => (
              <Select
                {...control}
                options={TARGET_OPTIONS}
                value={step.targetBy}
                onChange={(targetBy) => set({ targetBy: targetBy as TargetBy })}
              />
            )}
          </Field>
          {step.targetBy === 'role' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field id="step-target-role" label="Rolle" error={errors.targetRole}>
                {(control) => (
                  <Select
                    {...control}
                    options={ROLE_OPTIONS}
                    value={step.targetRole}
                    onChange={(targetRole) => set({ targetRole })}
                  />
                )}
              </Field>
              <Field
                id="step-target-value"
                label="Name"
                hint="Sichtbarer Text oder aria-label, exakt."
                error={errors.targetValue}
              >
                {(control) => (
                  <Input
                    {...control}
                    value={step.targetValue}
                    onChange={(event) => set({ targetValue: event.target.value })}
                  />
                )}
              </Field>
            </div>
          ) : (
            <Field
              id="step-target-value"
              label={TARGET_VALUE_LABEL[step.targetBy]}
              hint={cssHint && <span className="text-warning">{cssHint}</span>}
              error={errors.targetValue}
            >
              {(control) => (
                <Input
                  {...control}
                  mono={step.targetBy === 'css' || step.targetBy === 'testId'}
                  value={step.targetValue}
                  onChange={(event) => set({ targetValue: event.target.value })}
                />
              )}
            </Field>
          )}
        </>
      )}

      {value && (
        <Field id="step-value" label={value.label} hint={value.hint} error={errors.value}>
          {(control) => (
            <Input
              {...control}
              mono={value.mono}
              value={step.value}
              onChange={(event) => set({ value: event.target.value })}
            />
          )}
        </Field>
      )}

      {step.type === 'screenshot' && (
        <Checkbox
          label="Ganze Seite aufnehmen, nicht nur den sichtbaren Bereich"
          checked={step.fullPage}
          onChange={(event) => set({ fullPage: event.target.checked })}
        />
      )}

      {step.type === 'wait' && step.waitKind === 'duration' && (
        <Field id="step-wait-seconds" label="Sekunden" error={errors.waitSeconds}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={step.waitSeconds}
              onChange={(event) => set({ waitSeconds: event.target.value })}
            />
          )}
        </Field>
      )}

      {step.type !== 'basicAuth' && (
        <Field
          id="step-timeout"
          label="Timeout (Sekunden)"
          hint="So lange wartet der Bot auf die Seite oder das Element."
          error={errors.timeoutSeconds}
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={step.timeoutSeconds}
              onChange={(event) => set({ timeoutSeconds: event.target.value })}
            />
          )}
        </Field>
      )}

      {errors.general && <p className="text-small text-danger">{errors.general}</p>}
    </Card>
  );
}
