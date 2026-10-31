'use client';

import { TEMPLATE_STEP_TYPES } from '@click-bot/shared';
import { useState, useTransition } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { DeleteSection } from '@/components/organisms/DeleteSection';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StepForm } from '@/components/organisms/StepForm';
import { StepList } from '@/components/organisms/StepList';
import { TemplateDetailsForm } from '@/components/organisms/TemplateDetailsForm';
import { EditorLayout } from '@/components/templates/EditorLayout';
import {
  errorsByPath,
  moveStep,
  removeStep,
  stepErrors,
  type Issue,
  type StepListState,
} from '@/lib/job-draft';
import { describeStep } from '@/lib/step-view';
import { appendTemplateStep, validateTemplate, type TemplateDraft } from '@/lib/template-draft';
import type { FormState } from '@/lib/views';

export type TemplateEditorProps = {
  /** Omitted for a new template. */
  templateId?: string;
  initial: TemplateDraft;
  /** New template: creates it and goes back to the list. */
  createAction?: (draft: TemplateDraft) => Promise<{ issues: Issue[] }>;
  /** Existing template: saves it. */
  updateAction?: (templateId: string, draft: TemplateDraft) => Promise<{ issues: Issue[] }>;
  deleteAction?: (state: FormState, formData: FormData) => Promise<FormState>;
};

/** State of the template pages: name and note on the left, the steps on the right. */
export function TemplateEditor({
  templateId,
  initial,
  createAction,
  updateAction,
  deleteAction,
}: TemplateEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [selected, setSelected] = useState<number | null>(initial.steps.length > 0 ? 0 : null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const isNew = templateId === undefined;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = errorsByPath(issues);
  const title = isNew ? 'Neue Vorlage' : saved.name;

  function update(patch: Partial<TemplateDraft>) {
    setDraft((old) => ({ ...old, ...patch }));
    setJustSaved(false);
  }

  function applySteps(next: StepListState, clearIssues = true) {
    update({ steps: next.steps });
    setSelected(next.selected);
    if (clearIssues) setIssues([]);
  }

  /** Opens the first step with a problem, so its form shows the message. */
  function selectStepOf(found: Issue[]) {
    const index = found
      .map((issue) => /^flow\.steps\.(\d+)/.exec(issue.path)?.[1])
      .find((match) => match !== undefined);
    if (index !== undefined) setSelected(Number(index));
  }

  function save() {
    const found = validateTemplate(draft);
    setIssues(found);
    if (found.length > 0) return selectStepOf(found);
    startSaving(async () => {
      // A new template goes back to the list on success.
      const result =
        templateId === undefined
          ? await createAction?.(draft)
          : await updateAction?.(templateId, draft);
      const problems = result?.issues ?? [];
      setIssues(problems);
      if (problems.length > 0) return selectStepOf(problems);
      setSaved(draft);
      setJustSaved(true);
    });
  }

  const selectedStep = selected === null ? undefined : draft.steps[selected];

  return (
    <EditorLayout
      header={
        <PageHeader
          title={title}
          description="Ein Ablauf für jede Website. Im Assistenten „Neuer Test“ unter „Aus Vorlage“."
          breadcrumb={[{ label: 'Vorlagen', href: '/vorlagen' }, { label: title }]}
        />
      }
      actions={
        <>
          <Button variant="secondary" href="/vorlagen">
            {isNew ? 'Abbrechen' : 'Zurück'}
          </Button>
          <Button
            icon={<Icon name="check" size={16} />}
            loading={saving}
            disabled={!isNew && !dirty}
            onClick={save}
          >
            {isNew ? 'Vorlage anlegen' : 'Speichern'}
          </Button>
        </>
      }
      message={
        issues.length > 0 ? (
          <p
            role="alert"
            className="rounded-input bg-danger-soft px-3 py-2.5 text-body text-danger"
          >
            Nicht gespeichert: {errors.form ?? 'Bitte die markierten Angaben prüfen.'}
          </p>
        ) : justSaved ? (
          <p
            role="status"
            className="rounded-input bg-success-soft px-3 py-2.5 text-body text-success"
          >
            Gespeichert. Tests, die schon aus der Vorlage entstanden sind, behalten ihre Schritte.
          </p>
        ) : null
      }
      settings={
        <>
          <TemplateDetailsForm values={draft} errors={errors} onChange={update} />
          {templateId && deleteAction && (
            <DeleteSection
              title="Vorlage löschen"
              description="Tests, die aus der Vorlage entstanden sind, behalten ihre Schritte."
              buttonLabel="Vorlage löschen"
              fields={{ id: templateId }}
              action={deleteAction}
            />
          )}
        </>
      }
    >
      <StepList
        steps={draft.steps.map((step, index) => ({
          key: step.id,
          view: describeStep(step),
          invalid: Object.keys(stepErrors(issues, index)).length > 0,
        }))}
        selectedIndex={selected}
        error={errors['flow.steps']}
        onSelect={setSelected}
        onAdd={() => applySteps(appendTemplateStep(draft.steps), false)}
        onMove={(index, delta) => applySteps(moveStep(draft.steps, index, delta))}
        onRemove={(index) => applySteps(removeStep(draft.steps, index, selected))}
      />
      {selected !== null && selectedStep && (
        <StepForm
          index={selected}
          step={selectedStep}
          errors={stepErrors(issues, selected)}
          types={TEMPLATE_STEP_TYPES}
          onChange={(changed) =>
            update({
              steps: draft.steps.map((other, index) => (index === selected ? changed : other)),
            })
          }
        />
      )}
    </EditorLayout>
  );
}
