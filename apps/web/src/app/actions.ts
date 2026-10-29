'use server';

import {
  createCustomer,
  createJob,
  createRecordingSession,
  getJob,
  getWorkerStatus,
  NotFoundError,
  queueTestRun,
  secureStepPasswords,
  setJobActive,
  updateJob,
  ValidationError,
} from '@click-bot/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  jobToDraft,
  normaliseUrl,
  toJobUpdateInput,
  toNewJobInput,
  validateJobEdit,
  validateWizardStep,
  WIZARD_STEPS,
  type Issue,
  type WizardDraft,
} from '@/lib/job-draft';
import type { CustomerFormState } from '@/components/organisms/CustomerForm';
import type { StartRecordingAction } from '@/lib/views';
import { requireUser } from '@/server/auth';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';

/** Pauses or resumes a job from the status switch of the jobs table. */
export async function toggleJobAction(formData: FormData): Promise<void> {
  // Server actions are public endpoints: check the session here, not only on the page.
  await requireUser();
  const jobId = formData.get('jobId');
  if (typeof jobId !== 'string' || jobId === '') throw new Error('jobId fehlt.');

  await setJobActive(getDb(), jobId, formData.get('active') === 'true');
  revalidatePath('/');
}

export type CreateJobResult = { issues: Issue[] };

/**
 * Saves the job from the "Neuer Job" wizard as active and returns to the job list. Problems come
 * back as issues with field paths, so the wizard can show them at the right step.
 */
export async function createJobAction(draft: WizardDraft): Promise<CreateJobResult> {
  await requireUser();
  const now = new Date();
  // The wizard checks the same, but a server action can be called by anyone: check again,
  // including the confirmation that the website may be tested.
  const issues = WIZARD_STEPS.flatMap((step) => validateWizardStep(draft, step.key, now));
  if (issues.length > 0) return { issues };

  try {
    const db = getDb();
    const input = toNewJobInput(draft, now);
    // .htaccess passwords are stored encrypted as the customer's secrets, never in the flow.
    const flow = await secureStepPasswords(db, getCipher(), input);
    await createJob(db, { ...input, flow });
  } catch (error) {
    if (error instanceof ValidationError) return { issues: error.issues };
    throw error;
  }
  revalidatePath('/');
  redirect('/');
}

export type UpdateJobResult = { issues: Issue[] };

const GONE: Issue = { path: 'job', message: 'Diesen Job gibt es nicht mehr.' };

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

export type TestRunResult = { issues: Issue[]; runId?: string };

/**
 * "Testlauf starten": saves unsaved changes first (`draft`), because the worker runs the stored
 * job, then queues one test run. Returns the run to show, or why nothing was started.
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
    const { runId } = await queueTestRun(getDb(), jobId, new Date());
    return { issues: [], runId };
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
  try {
    await createCustomer(getDb(), { name });
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.issues[0]?.message, name };
    throw error;
  }
  revalidatePath('/projekte');
  redirect('/projekte');
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
    return { ok: false, message: 'Der Worker ist offline. Ohne ihn gibt es keinen Live-Browser.' };
  }
  const { token } = await createRecordingSession(db, { userId: user.id, startUrl: url }, now);
  const base = (process.env.LIVE_URL ?? 'ws://localhost:4200').replace(/\/+$/, '');
  return { ok: true, url: `${base}/live?token=${encodeURIComponent(token)}` };
}
