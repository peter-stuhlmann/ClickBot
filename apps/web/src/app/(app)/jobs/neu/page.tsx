import {
  DEFAULT_CAMPAIGN,
  getJob,
  getRunReport,
  latestTestRun,
  listAiProviders,
  listCampaigns,
  listTemplates,
  NotFoundError,
} from '@click-bot/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { restoreWizardState } from '@/lib/wizard-state';
import { getDb } from '@/server/db';
import { getShell, projectScope } from '@/server/shell';
import { toTemplateView } from '@/server/templates-view';
import { toTestRunView } from '@/server/test-run-view';
import {
  createJobAction,
  deleteJobAction,
  saveDraftAction,
  startDraftTestRunAction,
  startRecordingAction,
  testRunStatusAction,
  watchRunAction,
} from '@/app/actions';
import { NewJobWizard, type NewJobWizardProps } from './new-job-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Neuer Test · Click-Bot' };

type Props = { searchParams: Promise<{ entwurf?: string | string[] }> };

/** Screen 05 "Neuer Job", in a campaign of the current project; `?entwurf=<id>` continues one. */
export default async function NewJobPage({ searchParams }: Props) {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db);
  const { entwurf } = await searchParams;
  const [campaigns, templates, providers] = await Promise.all([
    listCampaigns(db, projectScope(shell.project).customerId),
    listTemplates(db),
    listAiProviders(db),
  ]);

  let initial: NewJobWizardProps['initial'] = null;
  if (typeof entwurf === 'string') {
    const job = await getJob(db, entwurf).catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
    // Gone, or a draft of another project: a new test in this one.
    if (!job || job.customerId !== shell.project?.id) redirect('/jobs/neu');
    const state = job.status === 'draft' ? restoreWizardState(job.wizardState, now) : null;
    // Created meanwhile, or saved in the editor: the editor shows it.
    if (!state) redirect(`/jobs/${job.id}`);
    const runId = await latestTestRun(db, job.id);
    initial = {
      draftId: job.id,
      savedAt: job.updatedAt.toISOString(),
      state,
      testRun: runId
        ? toTestRunView(await getRunReport(db, runId), { workerOnline: shell.worker.online })
        : null,
    };
  }

  return (
    <>
      {/* A new key per project and draft: switching either starts the wizard afresh. */}
      <NewJobWizard
        key={`${shell.project?.id ?? 'none'}:${initial?.draftId ?? 'neu'}`}
        campaigns={campaigns}
        now={now.toISOString()}
        createAction={createJobAction}
        saveDraft={saveDraftAction}
        startTestRun={startDraftTestRunAction}
        testRunStatus={testRunStatusAction}
        watchRun={watchRunAction}
        deleteAction={deleteJobAction}
        initial={initial}
        startRecording={startRecordingAction}
        templates={templates.map((template) => ({
          view: toTemplateView(template, now),
          flow: template.flow,
        }))}
        aiReady={providers.some((provider) => provider.isDefault)}
        workerOnline={shell.worker.online}
        defaultCampaignId={
          (campaigns.find((campaign) => campaign.name === DEFAULT_CAMPAIGN) ?? campaigns[0])?.id ??
          ''
        }
      />
    </>
  );
}
