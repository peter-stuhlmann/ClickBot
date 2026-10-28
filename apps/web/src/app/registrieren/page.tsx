import { hasUsers } from '@click-bot/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountForm } from '@/components/organisms/AccountForm';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { getDb } from '@/server/db';
import { registerAction } from '../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Registrieren · Click-Bot' };

/** Only for a new installation: the first account becomes the admin. */
export default async function RegisterPage() {
  if (await hasUsers(getDb())) {
    return (
      <AuthLayout
        title="Registrierung geschlossen"
        description="Click-Bot hat schon ein Konto. Neue Konten gibt es nur per Einladung durch einen Admin."
      >
        <Link href="/anmelden" className="text-body font-medium text-primary hover:underline">
          Zur Anmeldung
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Erstes Konto anlegen"
      description="Dieses Konto wird Admin und lädt später alle weiteren Personen ein. Danach richtest du die Zwei-Faktor-Anmeldung ein."
    >
      <AccountForm action={registerAction} submitLabel="Konto anlegen" />
    </AuthLayout>
  );
}
