import 'server-only';
import { avatarUrl } from '@/lib/avatar';
import { requireUser } from './auth';

export type CurrentUser = { name: string; role: string; avatarSrc: string | null };

export const ROLE_LABEL = { admin: 'Admin', member: 'Mitglied' } as const;

/** The signed-in user for the sidebar; sends everyone else to the login. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await requireUser();
  return {
    name: user.name,
    role: ROLE_LABEL[user.role],
    avatarSrc: avatarUrl(user.id, user.avatarUpdatedAt),
  };
}
