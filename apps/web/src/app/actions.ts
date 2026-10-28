'use server';

import {
  createJob,
  getJob,
  NotFoundError,
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
 * Saves the editor. Starts in the past are only accepted if they were already stored, so the
 * stored job is loaded here as the reference, not taken from the browser.
 */
export async function updateJobAction(jobId: string, draft: WizardDraft): Promise<UpdateJobResult> {
  const db = getDb();
  const now = new Date();
  try {
    const loaded = jobToDraft(await getJob(db, jobId), now);
    if (!('draft' in loaded)) return { issues: [{ path: 'job', message: loaded.notEditable }] };

    const issues = validateJobEdit(draft, loaded.draft, now);
    if (issues.length > 0) return { issues };

    await updateJob(db, jobId, toJobUpdateInput(draft, now));
  } catch (error) {
    if (error instanceof ValidationError) return { issues: error.issues };
    if (error instanceof NotFoundError) return { issues: [GONE] };
    throw error;
  }
  revalidatePath('/');
  revalidatePath(`/jobs/${jobId}`);
  return { issues: [] };
}
