import { getWaveReport, NotFoundError } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Notice } from '@/components/molecules/Notice';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StatGrid } from '@/components/organisms/StatGrid';
import { WaveRunsTable } from '@/components/organisms/WaveRunsTable';
import { ReportLayout } from '@/components/templates/ReportLayout';
import { loadRunCosts } from '@/server/cost-data';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { toWaveReportView } from '@/server/wave-report-view';
import { AutoRefresh } from '../../auto-refresh';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Start-Report · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/**
 * Screen 03b "Welle-Report": every device and browser of the start the run `id` belongs to,
 * side by side, with where and why it failed.
 */
export default async function WaveReportPage({ params }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const shell = await getShell(db);
  const { id } = await params;
  const report = await getWaveReport(db, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!report) notFound();
  const view = toWaveReportView(report, {
    workerOnline: shell.worker.online,
    costs: await loadRunCosts(
      db,
      report.runs.map((run) => run.id),
    ),
  });

  const aside =
    view.failures.length > 0 ? (
      <>
        {view.failures.map((failure) => (
          <Notice key={`${failure.title}\n${failure.message}`} tone="danger" title={failure.title}>
            <span className="block font-medium">{failure.where}</span>
            {failure.message}
          </Notice>
        ))}
      </>
    ) : undefined;

  return (
    <ReportLayout
      header={
        <PageHeader
          title={view.title}
          description={view.meta}
          status={view.status}
          breadcrumb={[
            { label: 'Tests', href: '/' },
            { label: view.jobName, href: view.jobHref },
            { label: view.title },
          ]}
        />
      }
      stats={<StatGrid cards={view.stats} />}
      aside={aside}
      asideLabel="Fehler"
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
      <WaveRunsTable rows={view.rows} summary={view.summary} />
    </ReportLayout>
  );
}
