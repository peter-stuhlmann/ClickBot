import { getWorkerStatus, listCustomers, listRuns } from '@click-bot/db';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/organisms/PageHeader';
import { RunFilters } from '@/components/organisms/RunFilters';
import { RunsTable } from '@/components/organisms/RunsTable';
import { AppShell } from '@/components/templates/AppShell';
import { ReportLayout } from '@/components/templates/ReportLayout';
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
import { getDb } from '@/server/db';
import { toRunListRow } from '@/server/run-list-view';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Läufe · Click-Bot' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Screen 14 "Läufe": every run of every job, filtered by the address. */
export default async function RunsPage({ searchParams }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const user = await getCurrentUser();
  const filters = parseRunFilters(await searchParams);
  const db = getDb();
  const now = new Date();
  const [{ rows, total }, customers, worker] = await Promise.all([
    listRuns(db, toRunQuery(filters, now)),
    listCustomers(db),
    getWorkerStatus(db, now),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell active="laeufe" user={user} worker={worker}>
      <ReportLayout
        header={
          <PageHeader
            title="Läufe"
            description="Alle Läufe aller Jobs. Ein Klick öffnet den Report."
          />
        }
        stats={null}
        asideLabel="Filter"
        asideOnTop
        aside={
          <RunFilters
            values={filters}
            customers={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
            results={RESULT_OPTIONS}
            periods={PERIOD_OPTIONS}
            devices={DEVICE_FILTER_OPTIONS}
          />
        }
      >
        <RunsTable
          rows={rows.map(toRunListRow)}
          summary={describePage(total, filters.seite)}
          pager={{
            label: `Seite ${filters.seite} von ${pages}`,
            previousHref: filters.seite > 1 ? pageHref(filters, filters.seite - 1) : undefined,
            nextHref: filters.seite < pages ? pageHref(filters, filters.seite + 1) : undefined,
          }}
        />
      </ReportLayout>
    </AppShell>
  );
}
