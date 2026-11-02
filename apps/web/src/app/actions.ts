'use server';

import {
  createCampaign,
  createCustomer,
  createJob,
  createTemplate,
  deleteTemplate,
  updateTemplate,
  deleteCampaign,
  deleteCustomer,
  deleteJob,
  updateCampaign,
  updateCustomer,
  updateProfile,
  listCustomers,
  createRecordingSession,
  createWatchToken,
  getCampaign,
  getJob,
  getRunReport,
  getWorkerStatus,
  moveSlot,
  NotFoundError,
  queueTestRun,
  saveJobDraft,
  secureStepPasswords,
  setJobActive,
  updateJob,
  ValidationError,
} from '@click-bot/db';
import { toTemplateFlow } from '@click-bot/shared';
import { testRunHref } from '@/lib/run-links';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  jobToDraft,
  normaliseUrl,
  suggestName,
  toJobUpdateInput,
  toNewJobInput,
  validateJobEdit,
  validateWizardStep,
  WIZARD_STEPS,
  type Issue,
  type WizardDraft,
} from '@/lib/job-draft';
import type { CustomerFormState } from '@/components/organisms/CustomerForm';
import { startOfWeek } from '@/lib/calendar';
import { field, toFormState } from '@/lib/form-state';
import { toTemplateInput, validateTemplate, type TemplateDraft } from '@/lib/template-draft';
import type { FormState, StartRecordingAction, TestRunView, WatchRunAction } from '@/lib/views';
import { restoreWizardState, storableState, type WizardState } from '@/lib/wizard-state';
import { requireUser } from '@/server/auth';
import { artifactsDir, removeRunArtifacts } from '@/server/artifacts';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';
import { getShell, PROJECT_COOKIE } from '@/server/shell';
import { toTestRunView } from '@/server/test-run-view';

/** Pauses or resumes a job from the status switch of the jobs table. */
export async function toggleJobAction(formData: FormData): Promise<void> {
  // Server actions are public endpoints: check the session here, not only on the page.
  await requireUser();
  const jobId = formData.get('jobId');
  if (typeof jobId !== 'string' || jobId === '') throw new Error('jobId fehlt.');

  await setJobActive(getDb(), jobId, formData.get('active') === 'true');
  revalidatePath('/');
}

/** "Jetzt ausführen" in the jobs table: a test run on every device and browser, then the report. */
export async function runJobNowAction(formData: FormData): Promise<void> {
  await requireUser();
  const jobId = formData.get('jobId');
  if (typeof jobId !== 'string' || jobId === '') throw new Error('jobId fehlt.');
  const batch = await queueTestRun(getDb(), jobId, new Date());
  redirect(testRunHref(batch));
}

export type CreateJobResult = { issues: Issue[] };

/** A wizard draft that is still one: a stale tab never turns another job into this one. */
async function wizardDraft(draftId: string | null) {
  if (!draftId) return null;
  try {
    const job = await getJob(getDb(), draftId);
    return job.status === 'draft' && job.wizardState !== null ? job : null;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/**
 * Saves the job from the "Neuer Job" wizard as active and returns to the job list. A draft the
 * wizard saved on the way (`draftId`) becomes the job, with its test runs. Problems come back as
 * issues with field paths, so the wizard can show them at the right step.
 */
export async function createJobAction(
  draft: WizardDraft,
  draftId: string | null = null,
): Promise<CreateJobResult> {
  await requireUser();
  const now = new Date();
  // The wizard checks the same, but a server action can be called by anyone: check again,
  // including the confirmation that the website may be tested.
  const issues = WIZARD_STEPS.flatMap((step) => validateWizardStep(draft, step.key, now));
  if (issues.length > 0) return { issues };

  try {
    const db = getDb();
    const input = toNewJobInput(draft, now);
    const campaign = await getCampaign(db, input.campaignId);
    if (!campaign) return { issues: [{ path: 'campaignId', message: 'Kampagne nicht gefunden.' }] };
    // .htaccess passwords are stored encrypted as the project's secrets, never in the flow.
    const flow = await secureStepPasswords(db, getCipher(), {
      customerId: campaign.customerId,
      startUrl: input.startUrl,
      flow: input.flow,
    });
    const saved = await wizardDraft(draftId);
    if (saved) {
      const { status: _status, ...fields } = input;
      await updateJob(db, saved.id, { ...fields, flow, now, activate: true });
    } else {
      await createJob(db, { ...input, flow });
    }
  } catch (error) {
    if (error instanceof ValidationError) return { issues: error.issues };
    throw error;
  }
  revalidatePath('/');
  redirect('/');
}

export type DraftSaveResult = {
  /** The draft job; null when it is gone (deleted or created elsewhere), so a new one starts. */
  draftId: string | null;
  /** When it was saved (ISO); null when nothing was saved this time. */
  savedAt: string | null;
};

/**
 * Stores the form of the wizard as a draft job. Typed .htaccess passwords go into encrypted
 * secrets only, never into the stored form.
 */
async function persistDraft(draftId: string | null, state: WizardState, now: Date) {
  const db = getDb();
  const input = toNewJobInput(state.draft, now);
  const saved = draftId ? await getJob(db, draftId) : null;
  const customerId = saved?.customerId ?? (await getCampaign(db, input.campaignId))?.customerId;
  const flow = customerId
    ? await secureStepPasswords(db, getCipher(), {
        customerId,
        startUrl: input.startUrl,
        flow: input.flow,
      })
    : input.flow;
  return saveJobDraft(db, draftId, {
    ...input,
    name: input.name || suggestName(state.draft),
    flow,
    wizardState: storableState(state, flow),
    now,
  });
}

/**
 * Autosave of the wizard: keeps the form as a draft, so a reload loses nothing. The form is
 * untrusted and read like a stored one (restoreWizardState).
 */
export async function saveDraftAction(
  draftId: string | null,
  form: WizardState,
): Promise<DraftSaveResult> {
  await requireUser();
  const now = new Date();
  const state = restoreWizardState(form, now);
  if (!state) return { draftId, savedAt: null };
  try {
    const job = await persistDraft(draftId, state, now);
    return { draftId: job.id, savedAt: now.toISOString() };
  } catch (error) {
    // Not valid enough to keep yet (no website): the next change tries again.
    if (error instanceof ValidationError) return { draftId, savedAt: null };
    if (error instanceof NotFoundError) return { draftId: null, savedAt: null };
    throw error;
  }
}

export type DraftTestRunResult = {
  issues: Issue[];
  draftId: string | null;
  run?: TestRunView;
};

const DRAFT_GONE: Issue = { path: 'job', message: 'Diesen Entwurf gibt es nicht mehr.' };

/**
 * "Testlauf" in the wizard: saves the draft and plays its flow once, on the first device and
 * browser, right away. Like the live browser, it visits the website before the test is approved
 * for its schedule; a draft is never planned.
 */
export async function startDraftTestRunAction(
  draftId: string | null,
  form: WizardState,
): Promise<DraftTestRunResult> {
  await requireUser();
  const now = new Date();
  const state = restoreWizardState(form, now);
  if (!state) return { issues: [DRAFT_GONE], draftId };
  const issues = validateWizardStep(state.draft, 'test', now);
  if (issues.length > 0) return { issues, draftId };
  try {
    const db = getDb();
    const job = await persistDraft(draftId, state, now);
    const batch = await queueTestRun(db, job.id, now, { once: true });
    const [report, worker] = await Promise.all([
      getRunReport(db, batch.runId),
      getWorkerStatus(db, now),
    ]);
    return {
      issues: [],
      draftId: job.id,
      run: toTestRunView(report, { workerOnline: worker.online }),
    };
  } catch (error) {
    if (error instanceof ValidationError) return { issues: error.issues, draftId };
    if (error instanceof NotFoundError) return { issues: [DRAFT_GONE], draftId: null };
    throw error;
  }
}

/** How the test run of the wizard stands; null when it is gone. */
export async function testRunStatusAction(runId: string): Promise<TestRunView | null> {
  await requireUser();
  const db = getDb();
  try {
    const [report, worker] = await Promise.all([
      getRunReport(db, runId),
      getWorkerStatus(db, new Date()),
    ]);
    return toTestRunView(report, { workerOnline: worker.online });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export type UpdateJobResult = { issues: Issue[] };

const GONE: Issue = { path: 'job', message: 'Diesen Test gibt es nicht mehr.' };

/**
 * Saves the editor's draft. Starts in the past are only accepted if they were already stored,
 * so the stored job is loaded here as the reference, not taken from the browser.
 */
async function saveJob(jobId: string, draft: WizardDraft): Promise<Issue[]> {
  const db = getDb();
  const now = new Date();
  try {
    const stored = await getJob(db, jobId);
    const loaded = jobToDraft(stored, now);
    if (!('draft' in loaded)) return [{ path: 'job', message: loaded.notEditable }];

    const issues = validateJobEdit(draft, loaded.draft, now);
    if (issues.length > 0) return issues;

    const input = toJobUpdateInput(draft, now);
    const flow = await secureStepPasswords(db, getCipher(), {
      ...input,
      customerId: stored.customerId,
    });
    await updateJob(db, jobId, { ...input, flow });
  } catch (error) {
    if (error instanceof ValidationError) return error.issues;
    if (error instanceof NotFoundError) return [GONE];
    throw error;
  }
  revalidatePath('/');
  revalidatePath(`/jobs/${jobId}`);
  return [];
}

export async function updateJobAction(jobId: string, draft: WizardDraft): Promise<UpdateJobResult> {
  await requireUser();
  return { issues: await saveJob(jobId, draft) };
}

export type TestRunResult = { issues: Issue[]; href?: string };

/**
 * "Jetzt ausführen" in the editor: saves unsaved changes first (`draft`), because the worker runs
 * the stored job, then queues a test run on every device and browser. Returns the report to
 * show, or why nothing was started.
 */
export async function startTestRunAction(
  jobId: string,
  draft: WizardDraft | null,
): Promise<TestRunResult> {
  await requireUser();
  if (draft) {
    const issues = await saveJob(jobId, draft);
    if (issues.length > 0) return { issues };
  }
  try {
    const batch = await queueTestRun(getDb(), jobId, new Date());
    return { issues: [], href: testRunHref(batch) };
  } catch (error) {
    if (error instanceof NotFoundError) return { issues: [GONE] };
    throw error;
  }
}

/** "Projekt anlegen" (screen 10): back to the project list, or the reason it did not work. */
export async function createCustomerAction(
  _state: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireUser();
  const name = formData.get('name');
  if (typeof name !== 'string') return { error: 'Name fehlt.' };
  let projectId: string;
  try {
    projectId = (await createCustomer(getDb(), { name })).id;
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.issues[0]?.message, name };
    throw error;
  }
  // The new project becomes the current one; it starts with the campaign "Allgemein".
  await rememberProject(projectId);
  revalidatePath('/', 'layout');
  redirect('/kampagnen');
}

async function rememberProject(projectId: string) {
  (await cookies()).set(PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });
}

/** "Kampagne anlegen" in the current project; back to the campaign list. */
export async function createCampaignAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = getDb();
  const { project } = await getShell(db);
  if (!project) return { error: 'Bitte zuerst ein Projekt anlegen.' };
  const values = {
    name: field(formData, 'name'),
    startsOn: field(formData, 'startsOn'),
    endsOn: field(formData, 'endsOn'),
    description: field(formData, 'description'),
  };
  try {
    await createCampaign(db, { customerId: project.id, ...values });
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, values);
    throw error;
  }
  revalidatePath('/kampagnen');
  redirect('/kampagnen');
}

/** The project switcher in the sidebar: every page then shows this project. */
export async function selectProjectAction(projectId: string): Promise<void> {
  await requireUser();
  const projects = await listCustomers(getDb());
  if (!projects.some((project) => project.id === projectId)) return;
  await rememberProject(projectId);
  revalidatePath('/', 'layout');
}

/**
 * "Im Browser aufnehmen": a one-time token for the live browser on the worker, valid for two
 * minutes. The browser connects to LIVE_URL with it; nothing else opens the live browser.
 */
export async function startRecordingAction(startUrl: string): ReturnType<StartRecordingAction> {
  const user = await requireUser();
  const url = normaliseUrl(String(startUrl ?? ''));
  if (!/^https?:\/\/\S+$/.test(url)) {
    return { ok: false, message: 'Bitte zuerst in Schritt 1 die Website angeben.' };
  }
  const db = getDb();
  const now = new Date();
  if (!(await getWorkerStatus(db, now)).online) {
    return {
      ok: false,
      message: 'Das Testsystem ist nicht verbunden. Ohne es gibt es keinen Live-Browser.',
    };
  }
  const { token } = await createRecordingSession(db, { userId: user.id, startUrl: url }, now);
  const base = (process.env.LIVE_URL ?? 'ws://localhost:4200').replace(/\/+$/, '');
  return { ok: true, url: `${base}/live?token=${encodeURIComponent(token)}` };
}

/**
 * "Live zuschauen": the address of the worker's live stream of a run. The token says which run
 * and is valid for two minutes; the worker reads it with SECRETS_KEY, like the web app writes it.
 */
export async function watchRunAction(runId: string): ReturnType<WatchRunAction> {
  await requireUser();
  const now = new Date();
  if (!(await getWorkerStatus(getDb(), now)).online) {
    return {
      ok: false,
      message: 'Das Testsystem ist nicht verbunden. Ohne es gibt es kein Live-Bild.',
    };
  }
  const token = createWatchToken(getCipher(), String(runId), now);
  const base = (process.env.LIVE_URL ?? 'ws://localhost:4200').replace(/\/+$/, '');
  return { ok: true, url: `${base}/watch?token=${encodeURIComponent(token)}` };
}

/** Runs a delete; a refusal (e.g. "hat noch Jobs") comes back as the form's error. */
async function refusalOf(remove: () => Promise<unknown>): Promise<FormState | null> {
  try {
    await remove();
    return null;
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.issues[0]?.message };
    if (error instanceof NotFoundError) return { error: 'Das gibt es nicht mehr.' };
    throw error;
  }
}

/** Renames a project ("Projekt bearbeiten"). */
export async function updateProjectAction(
  _state: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireUser();
  const name = field(formData, 'name');
  try {
    await updateCustomer(getDb(), field(formData, 'id'), { name });
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.issues[0]?.message, name };
    if (error instanceof NotFoundError)
      return { error: 'Dieses Projekt gibt es nicht mehr.', name };
    throw error;
  }
  revalidatePath('/', 'layout');
  redirect('/kampagnen');
}

/** Deletes a project without jobs; the switcher then shows the first project left. */
export async function deleteProjectAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const refused = await refusalOf(() => deleteCustomer(getDb(), field(formData, 'id')));
  if (refused) return refused;
  revalidatePath('/', 'layout');
  redirect('/kampagnen');
}

/** Changes name, period and note of a campaign. */
export async function updateCampaignAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = {
    name: field(formData, 'name'),
    startsOn: field(formData, 'startsOn'),
    endsOn: field(formData, 'endsOn'),
    description: field(formData, 'description'),
  };
  try {
    await updateCampaign(getDb(), field(formData, 'id'), values);
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, values);
    if (error instanceof NotFoundError) return { error: 'Diese Kampagne gibt es nicht mehr.' };
    throw error;
  }
  revalidatePath('/kampagnen');
  redirect('/kampagnen');
}

/** Deletes a campaign without jobs. */
export async function deleteCampaignAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  // With jobs only after typing "<name> löschen"; deleteCampaign checks the phrase itself.
  let runIds: string[] = [];
  const refused = await refusalOf(async () => {
    const deleted = await deleteCampaign(
      getDb(),
      field(formData, 'id'),
      field(formData, 'confirm'),
    );
    runIds = deleted.runIds;
  });
  if (refused) return refused;
  // Screenshots live outside the database; a leftover file is no reason to fail.
  await removeRunArtifacts(artifactsDir(), runIds).catch(() => undefined);
  revalidatePath('/kampagnen');
  redirect('/kampagnen');
}

/** "Job löschen" in the editor: the job with its runs, reports and screenshots. */
export async function deleteJobAction(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  let runIds: string[] = [];
  const refused = await refusalOf(async () => {
    runIds = (await deleteJob(getDb(), field(formData, 'id'))).runIds;
  });
  if (refused) return refused;
  // Screenshots live outside the database; a leftover file is no reason to fail.
  await removeRunArtifacts(artifactsDir(), runIds).catch(() => undefined);
  revalidatePath('/', 'layout');
  redirect('/');
}

/** "Profil": the own name and picture. E-mail and role are not read, whatever the form sends. */
export async function updateProfileAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const values = { name: field(formData, 'name') };
  const file = formData.get('avatar');
  const avatar =
    field(formData, 'removeAvatar') === '1'
      ? null
      : file instanceof File && file.size > 0
        ? new Uint8Array(await file.arrayBuffer())
        : undefined;
  try {
    await updateProfile(getDb(), user.id, { ...values, avatar }, new Date());
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, values);
    throw error;
  }
  // Name and picture show in the sidebar of every page.
  revalidatePath('/', 'layout');
  return { notice: 'Gespeichert.' };
}

/** Calendar (screen 13): moves a date as the load panel suggests, so that no run has to wait. */
export async function moveSlotAction(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const slotIndex = Number(field(formData, 'slotIndex'));
  if (!Number.isInteger(slotIndex) || slotIndex < 0) return { error: 'Der Termin fehlt.' };
  const refused = await refusalOf(() =>
    moveSlot(
      getDb(),
      field(formData, 'jobId'),
      {
        slotIndex,
        from: { date: field(formData, 'fromDate'), time: field(formData, 'fromTime') },
        to: { date: field(formData, 'toDate'), time: field(formData, 'toTime') },
      },
      new Date(),
    ),
  );
  if (refused) return refused;
  // Stay on the day of the date, which now shows that every run gets a browser.
  const day = field(formData, 'toDate');
  revalidatePath('/kalender');
  redirect(`/kalender?woche=${startOfWeek(day)}&tag=${day}`);
}

export type TemplateResult = { issues: Issue[] };

/** Saves a template; ValidationError becomes issues by path, like in the job forms. */
async function storeTemplate(save: () => Promise<unknown>): Promise<Issue[]> {
  try {
    await save();
    return [];
  } catch (error) {
    if (error instanceof ValidationError) return error.issues;
    if (error instanceof NotFoundError) {
      return [{ path: 'form', message: 'Diese Vorlage gibt es nicht mehr.' }];
    }
    throw error;
  }
}

/** "Neue Vorlage": creates the template and goes back to the templates. */
export async function createTemplateAction(draft: TemplateDraft): Promise<TemplateResult> {
  const user = await requireUser();
  const issues = validateTemplate(draft);
  if (issues.length > 0) return { issues };
  const stored = await storeTemplate(() =>
    createTemplate(getDb(), { ...toTemplateInput(draft), createdBy: user.id }),
  );
  if (stored.length > 0) return { issues: stored };
  revalidatePath('/vorlagen');
  redirect('/vorlagen');
}

/** Saves the editor of a template. Jobs made from it keep their steps. */
export async function updateTemplateAction(
  templateId: string,
  draft: TemplateDraft,
): Promise<TemplateResult> {
  await requireUser();
  const issues = validateTemplate(draft);
  if (issues.length > 0) return { issues };
  const stored = await storeTemplate(() =>
    updateTemplate(getDb(), templateId, toTemplateInput(draft)),
  );
  if (stored.length === 0) revalidatePath('/vorlagen');
  return { issues: stored };
}

/** "Vorlage löschen"; jobs made from it keep their steps. */
export async function deleteTemplateAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const refused = await refusalOf(() => deleteTemplate(getDb(), field(formData, 'id')));
  if (refused) return refused;
  revalidatePath('/vorlagen');
  redirect('/vorlagen');
}

/**
 * "Als Vorlage speichern" in the editor: the stored flow of the job, without opening the start
 * URL and without password protection, pages of the website as paths (toTemplateFlow).
 */
export async function saveJobAsTemplateAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const values = { name: field(formData, 'name'), description: field(formData, 'description') };
  const db = getDb();
  let job;
  try {
    job = await getJob(db, field(formData, 'jobId'));
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Diesen Test gibt es nicht mehr.', values };
    throw error;
  }
  const flow = toTemplateFlow(job.flow, job.startUrl);
  if (flow.steps.length === 0) {
    return {
      error:
        'Der Ablauf hat außer dem Öffnen der Adresse der Website keine Schritte für eine Vorlage.',
      values,
    };
  }
  let templateId = '';
  const issues = await storeTemplate(async () => {
    templateId = (await createTemplate(db, { ...values, flow, createdBy: user.id })).id;
  });
  if (issues.length > 0) return toFormState(issues, values);
  revalidatePath('/vorlagen');
  return {
    notice: `Vorlage „${values.name.trim()}“ gespeichert.`,
    link: `/vorlagen/${templateId}`,
  };
}
