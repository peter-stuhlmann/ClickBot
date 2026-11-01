import type { Metadata } from 'next';
import { PageHeader } from '@/components/organisms/PageHeader';
import { ProfileForm } from '@/components/organisms/ProfileForm';
import { avatarUrl } from '@/lib/avatar';
import { requireUser } from '@/server/auth';
import { ROLE_LABEL } from '@/server/session';
import { updateProfileAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Profil · Click-Bot' };

/** "Profil", from the user card in the sidebar: own name and picture; e-mail and role shown. */
export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Profil" description="So sieht dich dein Team in Click-Bot." />
      <ProfileForm
        name={user.name}
        email={user.email}
        role={ROLE_LABEL[user.role]}
        avatarSrc={avatarUrl(user.id, user.avatarUpdatedAt)}
        action={updateProfileAction}
      />
    </>
  );
}
