import type { Metadata } from 'next';
import { CustomerForm } from '@/components/organisms/CustomerForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { createCustomerAction, selectProjectAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Projekt anlegen · Click-Bot' };

export default async function NewCustomerPage() {
  const shell = await getShell(getDb(), new Date());

  return (
    <AppShell active="kampagnen" {...shell} selectProject={selectProjectAction}>
      <PageHeader
        title="Projekt anlegen"
        description="Ein Projekt fasst Kampagnen und Tests eines Kunden oder einer Website zusammen. Es startet mit der Kampagne „Allgemein“."
      />
      <CustomerForm action={createCustomerAction} />
    </AppShell>
  );
}
