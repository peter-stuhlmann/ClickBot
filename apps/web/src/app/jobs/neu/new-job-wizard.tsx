'use client';

import type { Flow } from '@click-bot/shared';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { AdBlockingForm } from '@/components/organisms/AdBlockingForm';
import { AnalyticsMarkingForm } from '@/components/organisms/AnalyticsMarkingForm';
import { ApprovalCard } from '@/components/organisms/ApprovalCard';
import { DevicePicker } from '@/components/organisms/DevicePicker';
import { GoalCard } from '@/components/organisms/GoalCard';
import { JobBasicsForm } from '@/components/organisms/JobBasicsForm';
import { JobSummary } from '@/components/organisms/JobSummary';
import { LiveBrowser } from '@/components/organisms/LiveBrowser';
import { MethodPicker, type FlowMethod } from '@/components/organisms/MethodPicker';
import { ScheduleForm } from '@/components/organisms/ScheduleForm';
import { StartUrlCard } from '@/components/organisms/StartUrlCard';
import { StepForm } from '@/components/organisms/StepForm';
import { StepList } from '@/components/organisms/StepList';
import { TemplatePicker } from '@/components/organisms/TemplatePicker';
import { WizardStepper } from '@/components/organisms/WizardStepper';
import { WizardLayout } from '@/components/templates/WizardLayout';
import { toggleDevice, toggleDeviceBrowser } from '@/lib/devices';
import {
  describeRunTotal,
  stepsForAiTask,
  emptyDraft,
  browserErrors,
  errorsByPath,
  moveStep,
  removeStep,
  scheduleErrors,
  stepErrors,
  summarise,
  validateWizardStep,
  withStartUrl,
  WIZARD_STEPS,
  wizardStepOf,
  type Issue,
  type StepDraft,
  type StepListState,
  type WizardDraft,
} from '@/lib/job-draft';
import { describeStep, FIXED_STEP_TYPES } from '@/lib/step-view';
import { stepsFromTemplate } from '@/lib/template-draft';
import type { StartRecordingAction, TemplateView } from '@/lib/views';
import { useLiveRecording } from './use-live-recording';

export type NewJobWizardProps = {
  /** The campaigns of the current project; with only one, it is chosen right away. */
  campaigns: { id: string; name: string }[];
  /** Server time of the request, so the defaults are the same on server and client. */
  now: string;
  createAction: (draft: WizardDraft) => Promise<{ issues: Issue[] }>;
  /** "Im Browser aufnehmen": a one-time address of the live browser. */
  startRecording: StartRecordingAction;
  /** "Aus Vorlage": the templates with their steps. */
  templates: { view: TemplateView; flow: Flow }[];
};

const NOT_SAVED =
  'Gespeichert wird erst am Ende. Bis dahin ist der Job ein Entwurf und läuft nicht.';

/** State and navigation of the "Neuer Job" wizard (screens 05 and 05b). */
export function NewJobWizard({
  campaigns,
  now,
  createAction,
  startRecording,
  templates,
}: NewJobWizardProps) {
  const renderedAt = useMemo(() => new Date(now), [now]);
  const [draft, setDraft] = useState(() => ({
    ...emptyDraft(renderedAt),
    campaignId: campaigns.length === 1 ? (campaigns[0]?.id ?? '') : '',
  }));
  const [current, setCurrent] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [method, setMethod] = useState<FlowMethod>('fixed');
  // Fixed flow: recording, choosing a template, or the steps to correct.
  const [fixedView, setFixedView] = useState<'record' | 'template' | 'list'>('record');
  // Each mode keeps its state while the other one is shown.
  const [goal, setGoal] = useState('');
  const [fixedSteps, setFixedSteps] = useState<StepDraft[]>([]);
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
    goTo(current + 1);
  }

  const setSteps = (steps: StepDraft[]) => update({ steps });

  /** Recorded steps or those of a template replace the flow; the list shows them to correct. */
  function takeOver(steps: StepDraft[]) {
    setSteps(steps);
    setSelected(null);
    setIssues([]);
    setFixedView('list');
  }

  /** Back from recording or a template: to the steps, if there are any yet. */
  function leaveFixedView() {
    recording.stop();
    setFixedView(draft.steps.length > 0 ? 'list' : 'record');
  }

  function chooseMethod(next: FlowMethod) {
    if (next === method) return;
    if (next === 'free') {
      // Leaving the recording closes the live browser on the server.
      recording.stop();
      setFixedSteps(draft.steps);
      setSteps(stepsForAiTask(draft.startUrl, goal));
    } else {
      setSteps(fixedSteps);
    }
    setSelected(null);
    setIssues([]);
    setMethod(next);
  }

  function changeGoal(next: string) {
    setGoal(next);
    setSteps(stepsForAiTask(draft.startUrl, next));
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
    case 'job':
      content = (
        <JobBasicsForm values={draft} campaigns={campaigns} errors={errors} onChange={update} />
      );
      break;
    case 'flow':
      content = (
        <>
          <StartUrlCard
            value={draft.startUrl}
            error={errors.startUrl}
            onChange={(startUrl) => update(withStartUrl(draft, startUrl))}
          />
          <MethodPicker method={method} onChoose={chooseMethod} />
          {method === 'free' ? (
            <GoalCard
              goal={goal}
              error={stepErrors(issues, 1).value ?? errors['flow.steps']}
              onChange={changeGoal}
            />
          ) : fixedView === 'record' ? (
            <>
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
                onCancel={leaveFixedView}
              />
              {recording.status !== 'live' && (
                <div>
                  <Button
                    variant="secondary"
                    icon={<Icon name="copy" size={16} />}
                    onClick={() => setFixedView('template')}
                  >
                    Aus Vorlage übernehmen
                  </Button>
                </div>
              )}
            </>
          ) : fixedView === 'template' ? (
            <>
              <TemplatePicker
                templates={templates.map((template) => template.view)}
                onApply={(templateId) => {
                  const chosen = templates.find((template) => template.view.id === templateId);
                  if (chosen) takeOver(stepsFromTemplate(chosen.flow, draft.startUrl));
                }}
              />
              <div>
                <Button variant="secondary" onClick={leaveFixedView}>
                  Zurück
                </Button>
              </div>
            </>
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
                onMove={(index, delta) => applySteps(moveStep(draft.steps, index, delta))}
                onRemove={(index) => applySteps(removeStep(draft.steps, index, selected))}
                actions={
                  <>
                    <Button
                      variant="secondary"
                      icon={<Icon name="record" size={16} />}
                      onClick={() => setFixedView('record')}
                    >
                      Neu aufnehmen
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<Icon name="copy" size={16} />}
                      onClick={() => setFixedView('template')}
                    >
                      Aus Vorlage übernehmen
                    </Button>
                  </>
                }
              />
              {selected !== null && selectedStep && (
                <StepForm
                  index={selected}
                  step={selectedStep}
                  errors={stepErrors(issues, selected)}
                  types={FIXED_STEP_TYPES}
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
            deviceBrowsers={draft.deviceBrowsers}
            error={errors.devices}
            browserErrors={browserErrors(issues)}
            onToggle={(device) => update(toggleDevice(draft.devices, draft.deviceBrowsers, device))}
            onToggleBrowser={(device, browser) =>
              update({
                deviceBrowsers: toggleDeviceBrowser(draft.deviceBrowsers, device, browser),
              })
            }
          />
          <AnalyticsMarkingForm
            marking={draft.analyticsMarking}
            onChange={(analyticsMarking) => update({ analyticsMarking })}
          />
          <AdBlockingForm blockAds={draft.blockAds} onChange={(blockAds) => update({ blockAds })} />
          <ApprovalCard
            confirmed={draft.confirmed}
            error={errors.confirmed}
            onChange={(confirmed) => update({ confirmed })}
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
          rows={summarise(draft, campaigns, renderedAt)}
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
