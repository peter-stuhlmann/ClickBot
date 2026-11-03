'use client';

import { runTargets } from '@click-bot/shared';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { AccordionItem } from '@/components/molecules/AccordionItem';
import { Icon } from '@/components/atoms/Icon';
import { AdBlockingForm } from '@/components/organisms/AdBlockingForm';
import { VideoForm } from '@/components/organisms/VideoForm';
import { AnalyticsMarkingForm } from '@/components/organisms/AnalyticsMarkingForm';
import { DevicePicker } from '@/components/organisms/DevicePicker';
import { DeleteSection } from '@/components/organisms/DeleteSection';
import { JobSettingsForm } from '@/components/organisms/JobSettingsForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { SaveTemplateCard } from '@/components/organisms/SaveTemplateCard';
import { ScheduleForm } from '@/components/organisms/ScheduleForm';
import { StepForm } from '@/components/organisms/StepForm';
import { StepList } from '@/components/organisms/StepList';
import { EditorLayout } from '@/components/templates/EditorLayout';
import { browserLabel, deviceLabel, toggleDevice, toggleDeviceBrowser } from '@/lib/devices';
import {
  appendStep,
  describeAdvanced,
  describeRunTotal,
  browserErrors,
  errorsByPath,
  moveStep,
  insertStep,
  removeStep,
  scheduleErrors,
  stepErrors,
  validateJobEdit,
  type Issue,
  type StepListState,
  type WizardDraft,
} from '@/lib/job-draft';
import { describeStep } from '@/lib/step-view';
import type { FormState, JobHeaderView } from '@/lib/views';

export type JobEditorProps = {
  jobId: string;
  header: JobHeaderView;
  /** The job as stored, as form state. */
  initial: WizardDraft;
  /** Server time of the request, so server and client render the same. */
  now: string;
  /** Positions of the dates that already have runs; they cannot move. */
  startedSlots: number[];
  saveAction: (jobId: string, draft: WizardDraft) => Promise<{ issues: Issue[] }>;
  /** The campaigns of the job's project, to move the job between them. */
  campaigns: { id: string; name: string }[];
  /** "Job löschen"; redirects to the job list. */
  deleteAction: (state: FormState, formData: FormData) => Promise<FormState>;
  /** "Als Vorlage speichern": the stored flow becomes a template. */
  saveTemplateAction: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Saves `draft` first if given, then queues a test run; `href` is the report to open. */
  testRunAction: (
    jobId: string,
    draft: WizardDraft | null,
  ) => Promise<{ issues: Issue[]; href?: string }>;
};

/** State of the editor (screen 02): settings, schedule, devices and flow of one job. */
export function JobEditor({
  jobId,
  header,
  initial,
  now,
  startedSlots,
  saveAction,
  testRunAction,
  campaigns,
  deleteAction,
  saveTemplateAction,
}: JobEditorProps) {
  const router = useRouter();
  const renderedAt = useMemo(() => new Date(now), [now]);
  const [draft, setDraft] = useState(initial);
  // Last saved state: decides whether there is anything to save, and which past starts may stay.
  const [saved, setSaved] = useState(initial);
  const [selected, setSelected] = useState<number | null>(initial.steps.length > 0 ? 0 : null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  // Open from the start when a setting was changed, so its warning is in view.
  const [advancedOpen, setAdvancedOpen] = useState(() => describeAdvanced(initial).changed);
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();

  // Dates are locked by their key, so they stay locked when other dates move around them.
  const lockedKeys = useMemo(
    () =>
      new Set(
        initial.schedule.type === 'times'
          ? startedSlots.flatMap((index) => initial.schedule.slots[index]?.key ?? [])
          : [],
      ),
    [initial, startedSlots],
  );
  const lockedSlots = draft.schedule.slots.flatMap((slot, index) =>
    lockedKeys.has(slot.key) ? [index] : [],
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = errorsByPath(issues);

  function update(patch: Partial<WizardDraft>) {
    setDraft((old) => ({ ...old, ...patch }));
    setJustSaved(false);
  }

  function applySteps(next: StepListState, clearIssues = true) {
    update({ steps: next.steps });
    setSelected(next.selected);
    if (clearIssues) setIssues([]);
  }

  function save() {
    const found = validateJobEdit(draft, saved, new Date());
    setIssues(found);
    if (found.length > 0) return selectStepOf(found);
    startSaving(async () => {
      const result = await saveAction(jobId, draft);
      setIssues(result.issues);
      if (result.issues.length > 0) return selectStepOf(result.issues);
      setSaved(draft);
      setJustSaved(true);
    });
  }

  /** Saves unsaved changes, then starts every device and browser and opens the report. */
  function testRun() {
    const found = dirty ? validateJobEdit(draft, saved, new Date()) : [];
    setIssues(found);
    if (found.length > 0) return selectStepOf(found);
    startTesting(async () => {
      const result = await testRunAction(jobId, dirty ? draft : null);
      setIssues(result.issues);
      if (result.issues.length > 0) return selectStepOf(result.issues);
      setSaved(draft);
      if (result.href) router.push(result.href);
    });
  }

  /** Opens the first flow step with a problem, so its form shows the message. */
  function selectStepOf(found: Issue[]) {
    const index = found
      .map((issue) => /^flow\.steps\.(\d+)/.exec(issue.path)?.[1])
      .find((match) => match !== undefined);
    if (index !== undefined) setSelected(Number(index));
  }

  const selectedStep = selected === null ? undefined : draft.steps[selected];
  const advanced = describeAdvanced(draft);
  // A test run starts every device in every browser at once, as queueTestRun does.
  const testTargets = runTargets(draft.devices, draft.deviceBrowsers);
  const [testTarget] = testTargets;
  const testRunHint =
    testTargets.length > 1
      ? `Auf allen gewählten Geräten und Browsern (${testTargets.length} Durchläufe), sofort.`
      : `Einmal auf ${deviceLabel(testTarget?.device ?? 'desktop')} in ${browserLabel(testTarget?.browser ?? 'chromium')}, sofort.`;

  return (
    <EditorLayout
      header={
        <PageHeader
          title={header.title}
          description={header.description}
          status={header.status}
          breadcrumb={[{ label: 'Tests', href: '/' }, { label: header.title }]}
        />
      }
      actions={
        <>
          <Button
            variant="secondary"
            icon={<Icon name="play" size={16} />}
            loading={testing}
            disabled={saving}
            onClick={testRun}
            title={`${testRunHint} Ungespeicherte Änderungen werden vorher gespeichert.`}
          >
            Jetzt ausführen
          </Button>
          <Button
            icon={<Icon name="check" size={16} />}
            loading={saving}
            disabled={!dirty || testing}
            onClick={save}
          >
            Speichern
          </Button>
        </>
      }
      message={
        issues.length > 0 ? (
          <p
            role="alert"
            className="rounded-input bg-danger-soft px-3 py-2.5 text-body text-danger"
          >
            Nicht gespeichert: {errors.job ?? 'Bitte die markierten Angaben prüfen.'}
          </p>
        ) : justSaved ? (
          <p
            role="status"
            className="rounded-input bg-success-soft px-3 py-2.5 text-body text-success"
          >
            Gespeichert. Die Änderungen gelten ab dem nächsten Durchlauf.
          </p>
        ) : null
      }
      settings={
        <>
          <JobSettingsForm values={draft} campaigns={campaigns} errors={errors} onChange={update} />
          <ScheduleForm
            schedule={draft.schedule}
            errors={scheduleErrors(issues)}
            note={describeRunTotal(draft, renderedAt)}
            onChange={(schedule) => update({ schedule })}
            lockedSlots={lockedSlots}
            typeLocked={startedSlots.length > 0}
          />
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
          <AccordionItem
            id="advanced"
            title="Erweiterte Einstellungen"
            description={advanced.summary}
            aside={advanced.changed ? <Badge tone="warning">Geändert</Badge> : undefined}
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((open) => !open)}
          >
            <div className="flex flex-col gap-6">
              <AnalyticsMarkingForm
                marking={draft.analyticsMarking}
                onChange={(analyticsMarking) => update({ analyticsMarking })}
              />
              <AdBlockingForm
                blockAds={draft.blockAds}
                onChange={(blockAds) => update({ blockAds })}
              />
              <VideoForm
                recordVideo={draft.recordVideo}
                onChange={(recordVideo) => update({ recordVideo })}
              />
            </div>
          </AccordionItem>
          <SaveTemplateCard
            jobId={jobId}
            defaultName={saved.name}
            action={saveTemplateAction}
            blocked={
              dirty
                ? 'Erst die Änderungen speichern: Die Vorlage übernimmt den gespeicherten Ablauf.'
                : undefined
            }
          />
          <DeleteSection
            title="Test löschen"
            description="Der Test verschwindet mit allen Durchläufen, Reports und Bildschirmfotos."
            buttonLabel="Test löschen"
            fields={{ id: jobId }}
            action={deleteAction}
          />
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
        onAdd={() => applySteps(appendStep(draft.steps, draft.startUrl), false)}
        onMove={(index, delta) => applySteps(moveStep(draft.steps, index, delta))}
        onRemove={(index) => applySteps(removeStep(draft.steps, index, selected))}
        onInsert={(index, type) => applySteps(insertStep(draft.steps, index, type))}
      />
      {selected !== null && selectedStep && (
        <StepForm
          index={selected}
          step={selectedStep}
          errors={stepErrors(issues, selected)}
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
