import { getDashboardStats, listJobOverview } from '@click-bot/db';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { JobsTable } from '@/components/organisms/JobsTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StatGrid } from '@/components/organisms/StatGrid';
import { loadJobCosts } from '@/server/cost-data';
import { getDb } from '@/server/db';
import { toJobRow, toStatCards } from '@/server/jobs-view';
import { getShell, projectScope } from '@/server/shell';
import { NO_AI_COST } from '@/lib/cost';
import { runJobNowAction, toggleJobAction } from '@/app/actions';

// Live data: never prerender at build time.
export const dynamic = 'force-dynamic';

/** Screen 01 "Jobs": the jobs of the current project. */
export default async function JobsPage() {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db);
  const scope = projectScope(shell.project);
  const [rows, stats] = await Promise.all([
    listJobOverview(db, scope),
    getDashboardStats(db, now, scope),
  ]);
  const costs = await loadJobCosts(
    db,
    rows.map((row) => row.id),
  );

  return (
    <>
      <PageHeader
        title="Tests"
        description={`${shell.project?.name ?? 'Kein Projekt'} · Jeder Test prüft eine Website nach Zeitplan in einem echten Browser.`}
        actions={
          <Button href="/jobs/neu" icon={<Icon name="plus" size={16} />}>
            Neuer Test
          </Button>
        }
      />
      <StatGrid cards={toStatCards(stats)} />
      <JobsTable
        rows={rows.map((row) => toJobRow(row, now, costs.get(row.id) ?? NO_AI_COST))}
        toggleAction={toggleJobAction}
        runAction={runJobNowAction}
      />
    </>
  );
}
