import type { Metadata } from 'next';
import { CustomerForm } from '@/components/organisms/CustomerForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { requireUser } from '@/server/auth';
import { createCustomerAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Projekt anlegen · Click-Bot' };

export default async function NewCustomerPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Projekt anlegen"
        description="Ein Projekt fasst Kampagnen und Tests eines Kunden oder einer Website zusammen. Es startet mit der Kampagne „Allgemein“."
      />
      <CustomerForm action={createCustomerAction} />
    </>
  );
}
