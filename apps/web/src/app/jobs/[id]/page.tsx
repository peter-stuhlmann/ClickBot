import { getJob, getWorkerStatus, listStartedSlots, NotFoundError } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Notice } from '@/components/molecules/Notice';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { jobToDraft } from '@/lib/job-draft';
import { getDb } from '@/server/db';
import { toJobHeader } from '@/server/job-editor-view';
import { getCurrentUser } from '@/server/session';
import { startTestRunAction, updateJobAction } from '../../actions';
import { JobEditor } from './job-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Job bearbeiten · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** Screen 02 "Editor": change an existing job. */
export default async function JobEditorPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();
  const now = new Date();
  const [job, user, worker] = await Promise.all([
    getJob(db, id).catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    }),
    getCurrentUser(db),
    getWorkerStatus(db, now),
  ]);
  if (!job) notFound();

  const startedSlots = await listStartedSlots(db, job.id);
  const loaded = jobToDraft(job, now);
  const header = toJobHeader(job);

  return (
    <AppShell active="jobs" user={user} worker={worker}>
      {'draft' in loaded ? (
        <JobEditor
          jobId={job.id}
          header={header}
          initial={loaded.draft}
          now={now.toISOString()}
          startedSlots={startedSlots}
          saveAction={updateJobAction}
          testRunAction={startTestRunAction}
        />
      ) : (
        <>
          <PageHeader
            title={header.title}
            description={header.description}
            status={header.status}
            breadcrumb={[{ label: 'Jobs', href: '/' }, { label: header.title }]}
          />
          <Notice tone="warning" title="Bearbeiten nicht möglich">
            {loaded.notEditable}
          </Notice>
        </>
      )}
    </AppShell>
  );
}
