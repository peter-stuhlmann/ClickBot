import { getDashboardStats, getWorkerStatus, listJobOverview } from '@click-bot/db';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { JobsTable } from '@/components/organisms/JobsTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StatGrid } from '@/components/organisms/StatGrid';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { toJobRow, toStatCards } from '@/server/jobs-view';
import { getCurrentUser } from '@/server/session';
import { toggleJobAction } from './actions';

// Live data: never prerender at build time.
export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  // Auth first: nothing is read for someone who is not signed in.
  const user = await getCurrentUser();
  const db = getDb();
  const now = new Date();
  const [rows, stats, worker] = await Promise.all([
    listJobOverview(db),
    getDashboardStats(db, now),
    getWorkerStatus(db, now),
  ]);

  return (
    <AppShell active="jobs" user={user} worker={worker}>
      <PageHeader
        title="Jobs"
        description="Automatisierte Browser-Abläufe, die nach Zeitplan laufen."
        actions={
          <Button href="/jobs/neu" icon={<Icon name="plus" size={16} />}>
            Neuer Job
          </Button>
        }
      />
      <StatGrid cards={toStatCards(stats)} />
      <JobsTable rows={rows.map((row) => toJobRow(row, now))} toggleAction={toggleJobAction} />
    </AppShell>
  );
}
