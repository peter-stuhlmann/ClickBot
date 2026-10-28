import { getWorkerStatus } from '@click-bot/db';
import type { Metadata } from 'next';
import { CustomerForm } from '@/components/organisms/CustomerForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/session';
import { createCustomerAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Kunde anlegen · Click-Bot' };

export default async function NewCustomerPage() {
  const db = getDb();
  const [user, worker] = await Promise.all([getCurrentUser(db), getWorkerStatus(db, new Date())]);

  return (
    <AppShell active="kunden" user={user} worker={worker}>
      <PageHeader
        title="Kunde anlegen"
        breadcrumb={[{ label: 'Kunden', href: '/kunden' }, { label: 'Kunde anlegen' }]}
      />
      <CustomerForm action={createCustomerAction} />
    </AppShell>
  );
}
