import type { Metadata } from 'next';
import { PageHeader } from '@/components/organisms/PageHeader';
import { ProfileForm } from '@/components/organisms/ProfileForm';
import { AppShell } from '@/components/templates/AppShell';
import { avatarUrl } from '@/lib/avatar';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { ROLE_LABEL } from '@/server/session';
import { getShell } from '@/server/shell';
import { selectProjectAction, updateProfileAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Profil · Click-Bot' };

/** "Profil", from the user card in the sidebar: own name and picture; e-mail and role shown. */
export default async function ProfilePage() {
  const user = await requireUser();
  const shell = await getShell(getDb(), new Date());

  return (
    <AppShell active="profil" {...shell} selectProject={selectProjectAction}>
      <PageHeader title="Profil" description="So sieht dich dein Team in Click-Bot." />
      <ProfileForm
        name={user.name}
        email={user.email}
        role={ROLE_LABEL[user.role]}
        avatarSrc={avatarUrl(user.id, user.avatarUpdatedAt)}
        action={updateProfileAction}
      />
    </AppShell>
  );
}
