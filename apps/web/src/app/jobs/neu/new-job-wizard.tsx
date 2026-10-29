'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { AiFlowPanel } from '@/components/organisms/AiFlowPanel';
import { AnalyticsMarkingForm } from '@/components/organisms/AnalyticsMarkingForm';
import { DevicePicker } from '@/components/organisms/DevicePicker';
import { JobSummary } from '@/components/organisms/JobSummary';
import { LiveBrowser } from '@/components/organisms/LiveBrowser';
import { MethodPicker, type FlowMethod } from '@/components/organisms/MethodPicker';
import { ScheduleForm } from '@/components/organisms/ScheduleForm';
import { StepForm } from '@/components/organisms/StepForm';
import { StepList } from '@/components/organisms/StepList';
import { WebsiteForm } from '@/components/organisms/WebsiteForm';
import { WizardStepper } from '@/components/organisms/WizardStepper';
import { WizardLayout } from '@/components/templates/WizardLayout';
import { toggleBrowser, toggleDevice } from '@/lib/devices';
import {
  appendStep,
  describeRunTotal,
  emptyDraft,
  errorsByPath,
  moveStep,
  newStep,
  removeStep,
  scheduleErrors,
  stepErrors,
  summarise,
  validateWizardStep,
  WIZARD_STEPS,
  wizardStepOf,
  type Issue,
  type StepDraft,
  type StepListState,
  type WizardDraft,
} from '@/lib/job-draft';
import { describeStep } from '@/lib/step-view';
import type { FlowSuggestionResult, StartRecordingAction, SuggestFlowAction } from '@/lib/views';
import { useLiveRecording } from './use-live-recording';

export type NewJobWizardProps = {
  customers: { id: string; name: string }[];
  /** Server time of the request, so the defaults are the same on server and client. */
  now: string;
  createAction: (draft: WizardDraft) => Promise<{ issues: Issue[] }>;
  /** "Mit KI beschreiben": suggested steps for a description. */
  suggestAction: SuggestFlowAction;
  /** "Im Browser aufnehmen": a one-time address of the live browser. */
  startRecording: StartRecordingAction;
};

const NOT_SAVED =
  'Gespeichert wird erst am Ende. Bis dahin ist der Job ein Entwurf und läuft nicht.';

/** State and navigation of the "Neuer Job" wizard (screens 05 and 05b). */
export function NewJobWizard({
  customers,
  now,
  createAction,
  suggestAction,
  startRecording,
}: NewJobWizardProps) {
  const renderedAt = useMemo(() => new Date(now), [now]);
  const [draft, setDraft] = useState(() => emptyDraft(renderedAt));
  const [current, setCurrent] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [method, setMethod] = useState<FlowMethod>('editor');
  const [aiDescription, setAiDescription] = useState('');
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({});
  const [aiResult, setAiResult] = useState<FlowSuggestionResult | null>(null);
  const [generating, startGenerating] = useTransition();
  const recording = useLiveRecording(startRecording);

  const step = WIZARD_STEPS[current] ?? WIZARD_STEPS[0];
  const isLast = current === WIZARD_STEPS.length - 1;
  const errors = errorsByPath(issues);
  const update = (patch: Partial<WizardDraft>) => setDraft((old) => ({ ...old, ...patch }));

  function goTo(index: number) {
    setIssues([]);
    setCurrent(index);
  }

  /** Shows the problems and jumps to the step (and flow step) of the first one. */
  function showIssues(found: Issue[]) {
    setIssues(found);
    const first = found[0];
    if (!first) return;
    setCurrent(WIZARD_STEPS.findIndex((wizardStep) => wizardStep.key === wizardStepOf(first.path)));
    const flowStep = /^flow\.steps\.(\d+)/.exec(first.path)?.[1];
    if (flowStep !== undefined) setSelected(Number(flowStep));
  }

  function save() {
    setIssues([]);
    startSaving(async () => {
      // On success the action redirects to the job list.
      const result = await createAction(draft);
      if (result.issues.length > 0) showIssues(result.issues);
    });
  }

  function next() {
    const found = validateWizardStep(draft, step.key, new Date());
    if (found.length > 0) return showIssues(found);
    if (isLast) return save();
    if (step.key === 'website' && draft.steps.length === 0) {
      update({ steps: [newStep('open', [], draft.startUrl)] });
      setSelected(0);
    }
    goTo(current + 1);
  }

  const setSteps = (steps: StepDraft[]) => update({ steps });

  function generate() {
    startGenerating(async () => {
      const answers = Object.entries(aiAnswers).map(([question, answer]) => ({ question, answer }));
      setAiResult(
        await suggestAction({ startUrl: draft.startUrl, description: aiDescription, answers }),
      );
    });
  }

  /** Suggested or recorded steps replace the flow; the step builder shows them for changes. */
  function takeOver(steps: StepDraft[]) {
    setSteps(steps);
    setSelected(null);
    setIssues([]);
    setMethod('editor');
  }

  function acceptSuggestion() {
    if (aiResult?.ok) takeOver(aiResult.steps);
  }

  function chooseMethod(next: FlowMethod) {
    // Leaving the recording closes the live browser on the server.
    if (method === 'record' && next !== 'record') recording.stop();
    setMethod(next);
  }

  function applySteps(next: StepListState, clearIssues = true) {
    setSteps(next.steps);
    setSelected(next.selected);
    if (clearIssues) setIssues([]);
  }

  const selectedStep = selected === null ? undefined : draft.steps[selected];
  const runTotal = describeRunTotal(draft, renderedAt);

  let content: ReactNode;
  switch (step.key) {
    case 'website':
      content = (
        <WebsiteForm values={draft} customers={customers} errors={errors} onChange={update} />
      );
      break;
    case 'flow':
      content = (
        <>
          <MethodPicker method={method} onChoose={chooseMethod} />
          {method === 'record' ? (
            <LiveBrowser
              status={recording.status}
              frame={recording.frame}
              url={recording.url}
              viewport={recording.viewport}
              mode={recording.mode}
              error={recording.error}
              steps={recording.steps.map(describeStep)}
              onStart={() => recording.start(draft.startUrl, recording.status === 'ended')}
              onInput={recording.send}
              onRemoveStep={recording.removeStep}
              onFinish={() => {
                recording.stop();
                takeOver(recording.steps);
              }}
              onCancel={() => chooseMethod('editor')}
            />
          ) : method === 'ai' ? (
            <AiFlowPanel
              description={aiDescription}
              onDescriptionChange={setAiDescription}
              onGenerate={generate}
              generating={generating}
              error={aiResult && !aiResult.ok ? aiResult.message : undefined}
              suggestion={
                aiResult?.ok
                  ? {
                      steps: aiResult.steps.map(describeStep),
                      questions: aiResult.questions,
                      facts: aiResult.facts,
                      notice: aiResult.notice,
                    }
                  : undefined
              }
              answers={aiAnswers}
              onAnswer={(question, answer) =>
                setAiAnswers((old) => ({ ...old, [question]: answer }))
              }
              onAccept={acceptSuggestion}
            />
          ) : (
            <>
              <StepList
                steps={draft.steps.map((flowStep, index) => ({
                  key: flowStep.id,
                  view: describeStep(flowStep),
                  invalid: Object.keys(stepErrors(issues, index)).length > 0,
                }))}
                selectedIndex={selected}
                error={errors['flow.steps']}
                onSelect={setSelected}
                onAdd={() => applySteps(appendStep(draft.steps, draft.startUrl), false)}
                onMove={(index, delta) => applySteps(moveStep(draft.steps, index, delta))}
                onRemove={(index) => applySteps(removeStep(draft.steps, index, selected))}
              />
              {selected !== null && selectedStep && (
                <StepForm
                  index={selected}
                  step={selectedStep}
                  errors={stepErrors(issues, selected)}
                  onChange={(changed) =>
                    setSteps(
                      draft.steps.map((other, index) => (index === selected ? changed : other)),
                    )
                  }
                />
              )}
            </>
          )}
        </>
      );
      break;
    case 'schedule':
      content = (
        <ScheduleForm
          schedule={draft.schedule}
          errors={scheduleErrors(issues)}
          note={runTotal}
          onChange={(schedule) => update({ schedule })}
        />
      );
      break;
    case 'devices':
      content = (
        <>
          <DevicePicker
            selected={draft.devices}
            error={errors.devices}
            onToggle={(device) => update({ devices: toggleDevice(draft.devices, device) })}
            browsers={draft.browsers}
            browserError={errors.browsers}
            onToggleBrowser={(browser) =>
              update({ browsers: toggleBrowser(draft.browsers, browser) })
            }
          />
          <AnalyticsMarkingForm
            marking={draft.analyticsMarking}
            onChange={(analyticsMarking) => update({ analyticsMarking })}
          />
        </>
      );
      break;
  }

  return (
    <WizardLayout
      title="Neuer Job"
      subtitle={`Schritt ${current + 1} von ${WIZARD_STEPS.length} · ${step.question}`}
      actions={
        <>
          {current === 0 ? (
            <Button variant="secondary" href="/">
              Abbrechen
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={<Icon name="arrowLeft" size={16} />}
              onClick={() => goTo(current - 1)}
            >
              Zurück
            </Button>
          )}
          {isLast ? (
            <Button icon={<Icon name="check" size={16} />} loading={saving} onClick={next}>
              Job anlegen
            </Button>
          ) : (
            <Button onClick={next}>
              Weiter
              <Icon name="arrowRight" size={16} />
            </Button>
          )}
        </>
      }
      stepper={<WizardStepper steps={WIZARD_STEPS} current={current} onSelect={goTo} />}
      aside={
        <JobSummary
          rows={summarise(draft, customers, renderedAt)}
          note={
            current >= 2 && runTotal
              ? `${runTotal}. Der Job startet direkt nach dem Anlegen.`
              : NOT_SAVED
          }
        />
      }
    >
      {issues.length > 0 && (
        <p role="alert" className="rounded-input bg-danger-soft px-3 py-2.5 text-body text-danger">
          Bitte die markierten Angaben prüfen.
        </p>
      )}
      {content}
    </WizardLayout>
  );
}
