'use server';

import {
  createCustomer,
  createJob,
  getJob,
  NotFoundError,
  queueTestRun,
  setJobActive,
  updateJob,
  ValidationError,
} from '@click-bot/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  jobToDraft,
  toJobUpdateInput,
  toNewJobInput,
  validateJobEdit,
  validateWizardStep,
  WIZARD_STEPS,
  type Issue,
  type WizardDraft,
} from '@/lib/job-draft';
import type { CustomerFormState } from '@/components/organisms/CustomerForm';
import { getDb } from '@/server/db';

/** Pauses or resumes a job from the status switch of the jobs table. */
export async function toggleJobAction(formData: FormData): Promise<void> {
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
  const now = new Date();
  // The wizard checks the same, but a server action can be called by anyone: check again,
  // including the confirmation that the website may be tested.
  const issues = WIZARD_STEPS.flatMap((step) => validateWizardStep(draft, step.key, now));
  if (issues.length > 0) return { issues };

  try {
    await createJob(getDb(), toNewJobInput(draft, now));
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
    const loaded = jobToDraft(await getJob(db, jobId), now);
    if (!('draft' in loaded)) return [{ path: 'job', message: loaded.notEditable }];

    const issues = validateJobEdit(draft, loaded.draft, now);
    if (issues.length > 0) return issues;

    await updateJob(db, jobId, toJobUpdateInput(draft, now));
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

/** "Kunde anlegen" (screen 10): back to the customer list, or the reason it did not work. */
export async function createCustomerAction(
  _state: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const name = formData.get('name');
  if (typeof name !== 'string') return { error: 'Name fehlt.' };
  try {
    await createCustomer(getDb(), { name });
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.issues[0]?.message, name };
    throw error;
  }
  revalidatePath('/kunden');
  redirect('/kunden');
}
