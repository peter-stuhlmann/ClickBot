import { getWorkerStatus, listOpenInvitations, listUsers } from '@click-bot/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice } from '@/components/molecules/Notice';
import { InviteForm } from '@/components/organisms/InviteForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { TeamList } from '@/components/organisms/TeamList';
import { AppShell } from '@/components/templates/AppShell';
import { currentSession, requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/session';
import { toInvitation, toTeamMember } from '@/server/team-view';
import { createInvitationAction, revokeInvitationAction } from '../../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Team · Click-Bot' };

/** "Einstellungen → Team": accounts and invitations. Only admins invite. */
export default async function TeamPage() {
  const signedIn = await requireUser();
  const user = await getCurrentUser();
  const isAdmin = signedIn.role === 'admin';
  const hasTotp = (await currentSession())?.hasTotp ?? false;
  const db = getDb();
  const now = new Date();
  const [members, invitations, worker] = await Promise.all([
    listUsers(db),
    isAdmin ? listOpenInvitations(db, now) : Promise.resolve([]),
    getWorkerStatus(db, now),
  ]);

  return (
    <AppShell active="einstellungen" user={user} worker={worker}>
      <PageHeader
        title="Team"
        description={
          isAdmin
            ? 'Wer Zugang zu Click-Bot hat. Neue Personen kommen nur per Einladungslink.'
            : 'Wer Zugang zu Click-Bot hat. Einladen können nur Admins.'
        }
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {!hasTotp && (
          <Notice tone="warning" title="Dein Konto hat keine 2FA">
            Bisher schützt nur dein Passwort den Zugang.{' '}
            <Link href="/anmelden/2fa" className="font-medium text-primary hover:underline">
              2FA jetzt einrichten
            </Link>
          </Notice>
        )}
        {isAdmin && <InviteForm action={createInvitationAction} />}
        <TeamList
          members={members.map(toTeamMember)}
          invitations={invitations.map(toInvitation)}
          revokeAction={isAdmin ? revokeInvitationAction : undefined}
        />
      </div>
    </AppShell>
  );
}
