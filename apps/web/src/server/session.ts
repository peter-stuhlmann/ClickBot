import 'server-only';
import { requireUser } from './auth';

export type CurrentUser = { name: string; role: string };

const ROLE_LABEL = { admin: 'Admin', member: 'Mitglied' } as const;

/** The signed-in user for the sidebar; sends everyone else to the login. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await requireUser();
  return { name: user.name, role: ROLE_LABEL[user.role] };
}
