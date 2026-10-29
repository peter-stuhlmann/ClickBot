import { listOpenInvitations, listUsers } from '@click-bot/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice } from '@/components/molecules/Notice';
import { Tabs } from '@/components/molecules/Tabs';
import { InviteForm } from '@/components/organisms/InviteForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { TeamList } from '@/components/organisms/TeamList';
import { AppShell } from '@/components/templates/AppShell';
import { SettingsLayout } from '@/components/templates/SettingsLayout';
import { SETTINGS_TABS } from '@/lib/settings-tabs';
import { currentSession, requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { toInvitation, toTeamMember } from '@/server/team-view';
import { selectProjectAction } from '../../actions';
import { createInvitationAction, revokeInvitationAction } from '../../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Team · Click-Bot' };

/** "Einstellungen → Team": accounts and invitations. Only admins invite. */
export default async function TeamPage() {
  const signedIn = await requireUser();
  const isAdmin = signedIn.role === 'admin';
  const hasTotp = (await currentSession())?.hasTotp ?? false;
  const db = getDb();
  const now = new Date();
  const [shell, members, invitations] = await Promise.all([
    getShell(db, now),
    listUsers(db),
    isAdmin ? listOpenInvitations(db, now) : Promise.resolve([]),
  ]);

  return (
    <AppShell active="einstellungen" {...shell} selectProject={selectProjectAction}>
      <SettingsLayout
        header={
          <PageHeader
            title="Einstellungen"
            description={
              isAdmin
                ? 'Team – wer Zugang zu Click-Bot hat. Neue Personen kommen nur per Einladungslink.'
                : 'Team – wer Zugang zu Click-Bot hat. Einladen können nur Admins.'
            }
          />
        }
        tabs={<Tabs label="Einstellungen" items={SETTINGS_TABS} current="/einstellungen/team" />}
      >
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
      </SettingsLayout>
    </AppShell>
  );
}
