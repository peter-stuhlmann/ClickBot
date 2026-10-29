import { getCustomerStats, getWorkerStatus, listCustomerOverview } from '@click-bot/db';
import type { Metadata } from 'next';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { CustomersTable } from '@/components/organisms/CustomersTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StatGrid } from '@/components/organisms/StatGrid';
import { AppShell } from '@/components/templates/AppShell';
import { toCustomerRow, toCustomerStatCards } from '@/server/customers-view';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Projekte · Click-Bot' };

/** Screen 10 "Kunden", in the app "Projekte". */
export default async function CustomersPage() {
  // Auth first: nothing is read for someone who is not signed in.
  const user = await getCurrentUser();
  const db = getDb();
  const now = new Date();
  const [rows, stats, worker] = await Promise.all([
    listCustomerOverview(db, now),
    getCustomerStats(db, now),
    getWorkerStatus(db, now),
  ]);

  return (
    <AppShell active="projekte" user={user} worker={worker}>
      <PageHeader
        title="Projekte"
        description="Alle Jobs und Läufe nach Projekt gruppiert."
        actions={
          <Button href="/projekte/neu" icon={<Icon name="plus" size={16} />}>
            Projekt anlegen
          </Button>
        }
      />
      <StatGrid cards={toCustomerStatCards(stats)} />
      <CustomersTable rows={rows.map((row) => toCustomerRow(row, now))} />
    </AppShell>
  );
}
