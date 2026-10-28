import 'server-only';
import type { Database } from '@click-bot/db';

export type CurrentUser = { name: string; role: string };

const ROLE_LABEL = { admin: 'Admin', member: 'Mitglied' } as const;

/**
 * Placeholder until login exists: the oldest user account. Replace with the session user
 * as soon as authentication is built.
 */
export async function getCurrentUser(db: Database): Promise<CurrentUser | null> {
  const user = await db.query.users.findFirst({
    orderBy: (users, { asc }) => [asc(users.createdAt)],
  });
  return user ? { name: user.name, role: ROLE_LABEL[user.role] } : null;
}
