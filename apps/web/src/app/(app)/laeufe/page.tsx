import { listCampaigns, listRuns } from '@click-bot/db';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/organisms/PageHeader';
import { RunFilters } from '@/components/organisms/RunFilters';
import { RunsTable } from '@/components/organisms/RunsTable';
import { ReportLayout } from '@/components/templates/ReportLayout';
import { NO_AI_COST } from '@/lib/cost';
import {
  DEVICE_FILTER_OPTIONS,
  PAGE_SIZE,
  PERIOD_OPTIONS,
  RESULT_OPTIONS,
  describePage,
  pageHref,
  parseRunFilters,
  toRunQuery,
} from '@/lib/run-filters';
import { loadRunCosts } from '@/server/cost-data';
import { getDb } from '@/server/db';
import { toRunListRow } from '@/server/run-list-view';
import { getShell, projectScope } from '@/server/shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Durchläufe · Click-Bot' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Screen 14 "Läufe": every run of the current project, filtered by the address. */
export default async function RunsPage({ searchParams }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db);
  const filters = parseRunFilters(await searchParams);
  const [{ rows, total }, campaigns] = await Promise.all([
    listRuns(db, { ...toRunQuery(filters, now), ...projectScope(shell.project) }),
    listCampaigns(db, projectScope(shell.project).customerId),
  ]);
  const costs = await loadRunCosts(
    db,
    rows.map((row) => row.id),
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <ReportLayout
        header={
          <PageHeader
            title="Durchläufe"
            description={`${shell.project?.name ?? 'Kein Projekt'} · Was die Tests ergeben haben, neueste zuerst. Ein Klick öffnet den Report.`}
          />
        }
        stats={null}
        asideLabel="Filter"
        asideOnTop
        aside={
          <RunFilters
            values={filters}
            campaigns={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
            results={RESULT_OPTIONS}
            periods={PERIOD_OPTIONS}
            devices={DEVICE_FILTER_OPTIONS}
          />
        }
      >
        <RunsTable
          rows={rows.map((row) => toRunListRow(row, costs.get(row.id) ?? NO_AI_COST))}
          summary={describePage(total, filters.seite)}
          pager={{
            label: `Seite ${filters.seite} von ${pages}`,
            previousHref: filters.seite > 1 ? pageHref(filters, filters.seite - 1) : undefined,
            nextHref: filters.seite < pages ? pageHref(filters, filters.seite + 1) : undefined,
          }}
        />
      </ReportLayout>
    </>
  );
}
