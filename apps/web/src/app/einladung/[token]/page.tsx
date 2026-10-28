import { getInvitation } from '@click-bot/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountForm } from '@/components/organisms/AccountForm';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { getDb } from '@/server/db';
import { acceptInvitationAction } from '../../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Einladung · Click-Bot',
  // The token is in the address: no search engine, no referrer to other sites.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Props = { params: Promise<{ token: string }> };

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const invitation = await getInvitation(getDb(), token, new Date());

  if (!invitation) {
    return (
      <AuthLayout
        title="Einladung ungültig"
        description="Diese Einladung ist abgelaufen oder wurde schon benutzt. Bitte frag deinen Admin nach einem neuen Link."
      >
        <Link href="/anmelden" className="text-body font-medium text-primary hover:underline">
          Zur Anmeldung
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={invitation.resetsAccount ? 'Zugang neu einrichten' : 'Einladung annehmen'}
      description={
        invitation.resetsAccount
          ? 'Für diese Adresse gibt es schon ein Konto. Du vergibst ein neues Passwort und richtest die Zwei-Faktor-Anmeldung neu ein; alle bisherigen Anmeldungen enden.'
          : `Du wirst als ${invitation.role === 'admin' ? 'Admin' : 'Mitglied'} zu Click-Bot eingeladen. Danach richtest du die Zwei-Faktor-Anmeldung ein.`
      }
    >
      <AccountForm
        action={acceptInvitationAction}
        submitLabel={invitation.resetsAccount ? 'Zugang neu einrichten' : 'Einladung annehmen'}
        fixedEmail={invitation.email}
        hidden={{ token }}
      />
    </AuthLayout>
  );
}
