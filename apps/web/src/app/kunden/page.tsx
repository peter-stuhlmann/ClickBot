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

export const metadata: Metadata = { title: 'Kunden · Click-Bot' };

/** Screen 10 "Kunden". */
export default async function CustomersPage() {
  const db = getDb();
  const now = new Date();
  const [rows, stats, user, worker] = await Promise.all([
    listCustomerOverview(db, now),
    getCustomerStats(db, now),
    getCurrentUser(db),
    getWorkerStatus(db, now),
  ]);

  return (
    <AppShell active="kunden" user={user} worker={worker}>
      <PageHeader
        title="Kunden"
        description="Alle Jobs und Läufe nach Kunde gruppiert."
        actions={
          <Button href="/kunden/neu" icon={<Icon name="plus" size={16} />}>
            Kunde anlegen
          </Button>
        }
      />
      <StatGrid cards={toCustomerStatCards(stats)} />
      <CustomersTable rows={rows.map((row) => toCustomerRow(row, now))} />
    </AppShell>
  );
}
