'use server';

import {
  acceptInvitation,
  confirmTotpSetup,
  createInvitation,
  getInvitation,
  getSession,
  login,
  registerFirstAdmin,
  revokeInvitation,
  ValidationError,
  verifyLoginCode,
  type CodeResult,
} from '@click-bot/db';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { field, toFormState } from '@/lib/form-state';
import type { FormState } from '@/lib/views';
import {
  clearSessionCookie,
  nextAuthStep,
  requireAdmin,
  sessionToken,
  setSessionCookie,
} from '@/server/auth';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';
import { newPasswordProblem } from '@/server/pwned';

/**
 * Login, 2FA, first registration and invitations. Passwords are never sent back to the form.
 * After every step the session cookie is set anew: the token changes when 2FA is done.
 */

/** "Registrieren": the first account, only while there is none. */
export async function registerAction(_state: FormState, data: FormData): Promise<FormState> {
  const input = {
    name: field(data, 'name'),
    email: field(data, 'email'),
    password: field(data, 'password'),
  };
  const values = { name: input.name, email: input.email };
  const leaked = await newPasswordProblem(input.password, input.email);
  if (leaked) return { values, fieldErrors: { password: leaked } };
  try {
    const { token } = await registerFirstAdmin(getDb(), input, new Date());
    await setSessionCookie(token, false);
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, values);
    throw error;
  }
  redirect('/anmelden/2fa');
}

/** First step of the login: e-mail and password. */
export async function loginAction(_state: FormState, data: FormData): Promise<FormState> {
  const email = field(data, 'email');
  const db = getDb();
  const now = new Date();
  const result = await login(db, { email, password: field(data, 'password') }, now);
  if ('error' in result) return { error: result.error, values: { email } };
  await setSessionCookie(result.token, false);
  redirect(nextAuthStep(await getSession(db, result.token, now)));
}

async function finishCode(result: CodeResult): Promise<FormState> {
  if ('error' in result) {
    if (result.restart) await clearSessionCookie();
    return { error: result.error, restart: result.restart };
  }
  await setSessionCookie(result.token, true);
  redirect('/');
}

/** Second step of the login: the code from the app. */
export async function loginCodeAction(_state: FormState, data: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (!token) redirect('/anmelden');
  const code = field(data, 'code');
  return finishCode(await verifyLoginCode(getDb(), getCipher(), token, code, new Date()));
}

/** First login: confirms the 2FA setup with the first code from the app. */
export async function totpSetupAction(_state: FormState, data: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (!token) redirect('/anmelden');
  const code = field(data, 'code');
  return finishCode(await confirmTotpSetup(getDb(), getCipher(), token, code, new Date()));
}

/** Accepting an invitation: name and password, then 2FA setup. */
export async function acceptInvitationAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const token = field(data, 'token');
  const name = field(data, 'name');
  const password = field(data, 'password');
  const db = getDb();
  const now = new Date();
  const invitation = await getInvitation(db, token, now);
  if (!invitation) return { error: 'Diese Einladung ist abgelaufen oder wurde schon benutzt.' };

  const leaked = await newPasswordProblem(password, invitation.email);
  if (leaked) return { values: { name }, fieldErrors: { password: leaked } };
  try {
    const session = await acceptInvitation(db, token, { name, password }, now);
    await setSessionCookie(session.token, false);
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, { name });
    throw error;
  }
  redirect('/anmelden/2fa');
}

/** Address of this app as the browser sees it, for links in invitations. */
async function appOrigin(): Promise<string> {
  // On the server APP_URL is set; the headers are only a fallback for local development.
  const configured = process.env.APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const protocol =
    list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

/** "Einstellungen → Team": a new invitation link, shown once. Admins only. */
export async function createInvitationAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const email = field(data, 'email');
  const role = field(data, 'role') === 'admin' ? 'admin' : 'member';
  try {
    const { token } = await createInvitation(
      getDb(),
      { email, role, createdBy: admin.id },
      new Date(),
    );
    revalidatePath('/einstellungen/team');
    return { link: `${await appOrigin()}/einladung/${token}` };
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, { email });
    throw error;
  }
}

/** Takes back an invitation link that was not used yet. Admins only. */
export async function revokeInvitationAction(data: FormData): Promise<void> {
  await requireAdmin();
  await revokeInvitation(getDb(), field(data, 'id'));
  revalidatePath('/einstellungen/team');
}
