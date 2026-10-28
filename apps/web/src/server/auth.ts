import 'server-only';
import { getSession, SESSION_DAYS, type SessionInfo, type SessionUser } from '@click-bot/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from './db';

export const SESSION_COOKIE = 'clickbot_session';
const PENDING_SECONDS = 15 * 60;

/** httpOnly (no script reads it), SameSite=Lax (no cross-site POST carries it), Secure in production. */
export function sessionCookieOptions(complete: boolean, production: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: production,
    path: '/',
    maxAge: complete ? SESSION_DAYS * 86_400 : PENDING_SECONDS,
  };
}

export async function setSessionCookie(token: string, complete: boolean): Promise<void> {
  const options = sessionCookieOptions(complete, process.env.NODE_ENV === 'production');
  (await cookies()).set(SESSION_COOKIE, token, options);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The session of this request, read once per request. */
export const currentSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await sessionToken();
  return token ? getSession(getDb(), token, new Date()) : null;
});

/** Where the login continues: password, 2FA code, 2FA setup, or the app ("/"). */
export function nextAuthStep(session: SessionInfo | null): string {
  if (!session) return '/anmelden';
  if (!session.complete) return session.hasTotp ? '/anmelden/code' : '/anmelden/2fa';
  return '/';
}

/** The signed-in user; everyone else is sent to the next step of the login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await currentSession();
  if (!session?.complete) redirect(nextAuthStep(session));
  return session.user;
}

/** Like requireUser, for admin pages: members go back to the start page. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}
