import { getDashboardStats, listJobOverview } from '@click-bot/db';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { JobsTable } from '@/components/organisms/JobsTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StatGrid } from '@/components/organisms/StatGrid';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { toJobRow, toStatCards } from '@/server/jobs-view';
import { getShell, projectScope } from '@/server/shell';
import { runJobNowAction, selectProjectAction, toggleJobAction } from './actions';

// Live data: never prerender at build time.
export const dynamic = 'force-dynamic';

/** Screen 01 "Jobs": the jobs of the current project. */
export default async function JobsPage() {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db, now);
  const scope = projectScope(shell.project);
  const [rows, stats] = await Promise.all([
    listJobOverview(db, scope),
    getDashboardStats(db, now, scope),
  ]);

  return (
    <AppShell active="jobs" {...shell} selectProject={selectProjectAction}>
      <PageHeader
        title="Tests"
        description={`${shell.project?.name ?? 'Kein Projekt'} · Automatisierte Browser-Abläufe, die nach Zeitplan laufen.`}
        actions={
          <Button href="/jobs/neu" icon={<Icon name="plus" size={16} />}>
            Neuer Test
          </Button>
        }
      />
      <StatGrid cards={toStatCards(stats)} />
      <JobsTable
        rows={rows.map((row) => toJobRow(row, now))}
        toggleAction={toggleJobAction}
        runAction={runJobNowAction}
      />
    </AppShell>
  );
}
