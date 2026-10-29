import { getWorkerStatus } from '@click-bot/db';
import type { Metadata } from 'next';
import { CustomerForm } from '@/components/organisms/CustomerForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/session';
import { createCustomerAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Projekt anlegen · Click-Bot' };

export default async function NewCustomerPage() {
  const user = await getCurrentUser();
  const worker = await getWorkerStatus(getDb(), new Date());

  return (
    <AppShell active="projekte" user={user} worker={worker}>
      <PageHeader
        title="Projekt anlegen"
        breadcrumb={[{ label: 'Projekte', href: '/projekte' }, { label: 'Projekt anlegen' }]}
      />
      <CustomerForm action={createCustomerAction} />
    </AppShell>
  );
}
