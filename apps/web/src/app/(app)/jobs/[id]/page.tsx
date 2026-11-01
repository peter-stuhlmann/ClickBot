import { getJob, listCampaigns, listStartedSlots, NotFoundError } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Notice } from '@/components/molecules/Notice';
import { PageHeader } from '@/components/organisms/PageHeader';
import { jobToDraft } from '@/lib/job-draft';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { toJobHeader } from '@/server/job-editor-view';
import {
  deleteJobAction,
  saveJobAsTemplateAction,
  startTestRunAction,
  updateJobAction,
} from '@/app/actions';
import { JobEditor } from './job-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Test bearbeiten · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** Screen 02 "Editor": change an existing job. */
export default async function JobEditorPage({ params }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const now = new Date();
  await requireUser();
  const { id } = await params;
  const job = await getJob(db, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!job) notFound();

  const [startedSlots, campaigns] = await Promise.all([
    listStartedSlots(db, job.id),
    listCampaigns(db, job.customerId),
  ]);
  const loaded = jobToDraft(job, now);
  const header = toJobHeader(job);

  return (
    <>
      {'draft' in loaded ? (
        <JobEditor
          jobId={job.id}
          header={header}
          initial={loaded.draft}
          now={now.toISOString()}
          startedSlots={startedSlots}
          saveAction={updateJobAction}
          testRunAction={startTestRunAction}
          campaigns={campaigns}
          deleteAction={deleteJobAction}
          saveTemplateAction={saveJobAsTemplateAction}
        />
      ) : (
        <>
          <PageHeader
            title={header.title}
            description={header.description}
            status={header.status}
            breadcrumb={[{ label: 'Tests', href: '/' }, { label: header.title }]}
          />
          <Notice tone="warning" title="Bearbeiten nicht möglich">
            {loaded.notEditable}
          </Notice>
        </>
      )}
    </>
  );
}
