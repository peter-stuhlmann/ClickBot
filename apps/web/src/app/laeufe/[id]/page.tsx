import { getRunReport, getWorkerStatus, NotFoundError } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Notice } from '@/components/molecules/Notice';
import { PageHeader } from '@/components/organisms/PageHeader';
import { RunStepList } from '@/components/organisms/RunStepList';
import { ScreenshotPanel } from '@/components/organisms/ScreenshotPanel';
import { StatGrid } from '@/components/organisms/StatGrid';
import { AppShell } from '@/components/templates/AppShell';
import { ReportLayout } from '@/components/templates/ReportLayout';
import { getDb } from '@/server/db';
import { toRunReportView } from '@/server/run-report-view';
import { getCurrentUser } from '@/server/session';
import { AutoRefresh } from './auto-refresh';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lauf-Report · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** Screen 03 "Lauf-Report": one run of a job, step by step. */
export default async function RunReportPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();
  const now = new Date();
  const [report, user, worker] = await Promise.all([
    getRunReport(db, id).catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    }),
    getCurrentUser(db),
    getWorkerStatus(db, now),
  ]);
  if (!report) notFound();
  const view = toRunReportView(report, { workerOnline: worker.online });

  const aside =
    view.failure || view.screenshot ? (
      <>
        {view.failure && (
          <Notice tone="danger" title={view.failure.title}>
            {view.failure.message}
          </Notice>
        )}
        {view.screenshot && <ScreenshotPanel {...view.screenshot} />}
      </>
    ) : undefined;

  return (
    <AppShell active="jobs" user={user} worker={worker}>
      <ReportLayout
        header={
          <PageHeader
            title={view.title}
            description={view.meta}
            status={view.status}
            breadcrumb={[
              { label: 'Jobs', href: '/' },
              { label: view.jobName, href: view.jobHref },
              { label: view.runLabel },
            ]}
          />
        }
        stats={<StatGrid cards={view.stats} />}
        aside={aside}
      >
        <AutoRefresh active={view.live !== null} />
        {view.live && (
          <p
            role="status"
            className="rounded-input bg-primary-soft px-3 py-2.5 text-body text-primary"
          >
            {view.live}
          </p>
        )}
        <RunStepList steps={view.steps} summary={view.stepsSummary} />
      </ReportLayout>
    </AppShell>
  );
}
