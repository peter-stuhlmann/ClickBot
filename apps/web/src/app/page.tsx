import { getDashboardStats, listJobOverview } from '@click-bot/db';
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
  const db = getDb();
  const now = new Date();
  const [rows, stats, user] = await Promise.all([
    listJobOverview(db),
    getDashboardStats(db, now),
    getCurrentUser(db),
  ]);

  return (
    // The worker does not report its status yet, so the shell shows it as offline.
    <AppShell active="jobs" user={user} worker={{ online: false, activeRuns: 0 }}>
      <PageHeader
        title="Jobs"
        description="Automatisierte Browser-Abläufe, die nach Zeitplan laufen."
        actions={<Button icon={<Icon name="plus" size={16} />}>Neuer Job</Button>}
      />
      <StatGrid cards={toStatCards(stats)} />
      <JobsTable rows={rows.map((row) => toJobRow(row, now))} toggleAction={toggleJobAction} />
    </AppShell>
  );
}
