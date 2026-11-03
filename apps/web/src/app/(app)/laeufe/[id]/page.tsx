import { getRunReport, NotFoundError } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Notice } from '@/components/molecules/Notice';
import { PageHeader } from '@/components/organisms/PageHeader';
import { RunStepList } from '@/components/organisms/RunStepList';
import { ScreenshotGallery } from '@/components/organisms/ScreenshotGallery';
import { StatGrid } from '@/components/organisms/StatGrid';
import { ReportLayout } from '@/components/templates/ReportLayout';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { toRunReportView } from '@/server/run-report-view';
import { AutoRefresh } from '../auto-refresh';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Durchlauf-Report · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** Screen 03 "Lauf-Report": one run of a job, step by step. */
export default async function RunReportPage({ params }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const shell = await getShell(db);
  const { id } = await params;
  const report = await getRunReport(db, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!report) notFound();
  const view = toRunReportView(report, { workerOnline: shell.worker.online });

  const aside =
    view.failure || view.screenshots.length > 0 || view.marking || view.ads ? (
      <>
        {view.marking && (
          <Notice tone="warning" title={view.marking.title}>
            {view.marking.message}
          </Notice>
        )}
        {view.ads && (
          <Notice tone="warning" title={view.ads.title}>
            {view.ads.message}
          </Notice>
        )}
        {view.failure && (
          <Notice tone="danger" title={view.failure.title}>
            {view.failure.message}
          </Notice>
        )}
        {view.screenshots.length > 0 && <ScreenshotGallery screenshots={view.screenshots} />}
      </>
    ) : undefined;

  return (
    <>
      <ReportLayout
        header={
          <PageHeader
            title={view.title}
            description={view.meta}
            status={view.status}
            breadcrumb={[
              { label: 'Tests', href: '/' },
              { label: view.jobName, href: view.jobHref },
              { label: view.runLabel },
            ]}
            actions={
              view.wave ? (
                <Button
                  variant="secondary"
                  href={view.wave.href}
                  icon={<Icon name="history" size={16} />}
                >
                  {view.wave.label}
                </Button>
              ) : undefined
            }
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
    </>
  );
}
