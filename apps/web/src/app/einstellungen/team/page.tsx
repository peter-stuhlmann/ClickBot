import { getWorkerStatus, listOpenInvitations, listUsers } from '@click-bot/db';
import type { Metadata } from 'next';
import { InviteForm } from '@/components/organisms/InviteForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { TeamList } from '@/components/organisms/TeamList';
import { AppShell } from '@/components/templates/AppShell';
import { requireUser } from '@/server/auth';
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
