import { createHash, randomBytes } from 'node:crypto';
import { passwordProblem } from '@click-bot/shared';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Database } from './client';
import type { Cipher } from './crypto';
import { ValidationError, type ValidationIssue } from './errors';
import { hashPassword, verifyPassword } from './passwords';
import { sessions, users } from './schema';
import { generateTotpSecret, verifyTotp } from './totp';

/**
 * Login with password and a 2FA code (TOTP), for the team only: the first account registers
 * itself as admin, everyone else comes by invitation (invitations.ts).
 *
 * A session starts after the password as "incomplete" (15 minutes) and becomes complete with the
 * 2FA code, or with the 2FA setup, or when an account without 2FA skips its setup (offered again
 * at every login). Completing it swaps the token. The cookie
 * carries a random token; the database stores only its SHA-256.
 */

export const SESSION_DAYS = 14;
export const PENDING_MINUTES = 15;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const MAX_FAILED_CODES = 5;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MAX_NAME = 120;

const WRONG_LOGIN = 'E-Mail oder Passwort ist falsch.';
const LOCKED = `Zu viele Fehlversuche. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.`;
const WRONG_CODE = 'Der Code stimmt nicht.';
const EXPIRED = 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.';
const TOO_MANY_CODES = 'Zu viele falsche Codes. Bitte neu anmelden.';

// Checked against unknown addresses, so a login takes as long whether the address exists or not.
const DUMMY_HASH = `scrypt$${'A'.repeat(22)}$${'A'.repeat(86)}`;

export type Role = 'admin' | 'member';
export type SessionUser = { id: string; name: string; email: string; role: Role };
export type SessionInfo = { user: SessionUser; complete: boolean; hasTotp: boolean };
export type LoginResult = { token: string } | { error: string };
export type CodeResult = { token: string } | { error: string; restart?: true };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Checks name, address and password of a new or reset account. */
export function accountIssues(input: {
  name: string;
  email: string;
  password: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = input.name.trim();
  if (!name) issues.push({ path: 'name', message: 'Name fehlt.' });
  else if (name.length > MAX_NAME) {
    issues.push({ path: 'name', message: `Name ist zu lang (höchstens ${MAX_NAME} Zeichen).` });
  }
  const email = normaliseEmail(input.email);
  if (!EMAIL.test(email)) {
    issues.push({ path: 'email', message: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
  }
  const password = passwordProblem(input.password, email);
  if (password) issues.push({ path: 'password', message: password });
  return issues;
}

/** Opens a session for `userId` and returns the token for the cookie. */
export async function openSession(
  db: Database,
  userId: string,
  complete: boolean,
  now: Date,
): Promise<string> {
  const token = newToken();
  const lifetime = complete ? SESSION_DAYS * DAY_MS : PENDING_MINUTES * MINUTE_MS;
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    complete,
    expiresAt: new Date(now.getTime() + lifetime),
  });
  return token;
}

export async function hasUsers(db: Database): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  return row !== undefined;
}

/** "Registrieren": only while there is no account yet. The first account is the admin. */
export async function registerFirstAdmin(
  db: Database,
  input: { name: string; email: string; password: string },
  now: Date,
): Promise<{ token: string }> {
  const issues = accountIssues(input);
  if (issues.length > 0) throw new ValidationError(issues);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    // Two registrations at the same moment must not both become the first account.
    await tx.execute(sql`LOCK TABLE users IN EXCLUSIVE MODE`);
    if (await hasUsers(tx)) {
      throw new ValidationError([
        {
          path: 'form',
          message: 'Es gibt schon ein Konto. Neue Konten gibt es nur per Einladung.',
        },
      ]);
    }
    const [user] = await tx
      .insert(users)
      .values({
        name: input.name.trim(),
        email: normaliseEmail(input.email),
        passwordHash,
        role: 'admin',
      })
      .returning({ id: users.id });
    return { token: await openSession(tx, (user as { id: string }).id, false, now) };
  });
}

/** First step of the login: e-mail and password. Opens an incomplete session. */
export async function login(
  db: Database,
  input: { email: string; password: string },
  now: Date,
): Promise<LoginResult> {
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${normaliseEmail(input.email)}`,
  });
  if (!user) {
    await verifyPassword(input.password, DUMMY_HASH);
    return { error: WRONG_LOGIN };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { error: LOCKED };

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db
      .update(users)
      .set(
        lock
          ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * MINUTE_MS) }
          : { failedLogins: failed },
      )
      .where(eq(users.id, user.id));
    return { error: lock ? LOCKED : WRONG_LOGIN };
  }

  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
  return { token: await openSession(db, user.id, false, now) };
}

async function findSession(db: Database, token: string, now: Date) {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hashToken(token)));
  if (!row) return null;
  if (row.session.expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  return row;
}

/** The session behind a cookie, or null if there is none (any more). */
export async function getSession(
  db: Database,
  token: string,
  now: Date,
): Promise<SessionInfo | null> {
  const row = await findSession(db, token, now);
  if (!row) return null;
  const { user, session } = row;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    complete: session.complete,
    hasTotp: user.totpSecretEnc !== null,
  };
}

export async function logout(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Removes expired sessions; the worker or a page may call it now and then. */
export async function deleteExpiredSessions(db: Database, now: Date): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}

/** An incomplete, valid session, or null. */
async function pendingSession(db: Database, token: string, now: Date) {
  const row = await findSession(db, token, now);
  return row && !row.session.complete ? row : null;
}

/** Counts a wrong code; after MAX_FAILED_CODES the login starts over. */
async function wrongCode(
  db: Database,
  sessionId: string,
  failedCodes: number,
): Promise<CodeResult> {
  if (failedCodes + 1 >= MAX_FAILED_CODES) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { error: TOO_MANY_CODES, restart: true };
  }
  await db
    .update(sessions)
    .set({ failedCodes: failedCodes + 1 })
    .where(eq(sessions.id, sessionId));
  return { error: WRONG_CODE };
}

/** Replaces the incomplete session by a complete one with a new token. */
async function completeSession(
  db: Database,
  sessionId: string,
  userId: string,
  now: Date,
): Promise<CodeResult> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return { token: await openSession(db, userId, true, now) };
}

/**
 * Remembers the step of an accepted code. Only one request can claim a step, so the same code
 * never works twice, even when sent twice at the same moment.
 */
async function claimStep(db: Database, userId: string, step: number): Promise<boolean> {
  const claimed = await db
    .update(users)
    .set({ totpLastStep: step })
    .where(and(eq(users.id, userId), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
    .returning({ id: users.id });
  return claimed.length > 0;
}

/** Second step of the login: the code from the authenticator app. */
export async function verifyLoginCode(
  db: Database,
  cipher: Cipher,
  token: string,
  code: string,
  now: Date,
): Promise<CodeResult> {
  const row = await pendingSession(db, token, now);
  const secretEnc = row?.user.totpSecretEnc;
  if (!row || !secretEnc) return { error: EXPIRED, restart: true };
  const { session, user } = row;

  const step = verifyTotp(cipher.decrypt(secretEnc), code, now, user.totpLastStep);
  if (step === null || !(await claimStep(db, user.id, step))) {
    return wrongCode(db, session.id, session.failedCodes);
  }
  return completeSession(db, session.id, user.id, now);
}

/**
 * First login without 2FA: the secret for the QR code. It is kept (encrypted) in the session, so
 * reloading the page shows the same code. Null if the account already has 2FA.
 */
export async function startTotpSetup(
  db: Database,
  cipher: Cipher,
  token: string,
  now: Date,
): Promise<{ secret: string; email: string } | null> {
  // Also from a complete session: 2FA that was skipped at login can be set up later.
  const row = await findSession(db, token, now);
  if (!row || row.user.totpSecretEnc) return null;
  const { session, user } = row;
  if (session.pendingTotpEnc) {
    return { secret: cipher.decrypt(session.pendingTotpEnc), email: user.email };
  }
  const secret = generateTotpSecret();
  await db
    .update(sessions)
    .set({ pendingTotpEnc: cipher.encrypt(secret) })
    .where(eq(sessions.id, session.id));
  return { secret, email: user.email };
}

/** Finishes the 2FA setup with the first code from the app; the secret is then the account's. */
export async function confirmTotpSetup(
  db: Database,
  cipher: Cipher,
  token: string,
  code: string,
  now: Date,
): Promise<CodeResult> {
  const row = await findSession(db, token, now);
  const pendingEnc = row?.session.pendingTotpEnc;
  if (!row || !pendingEnc || row.user.totpSecretEnc) return { error: EXPIRED, restart: true };
  const { session, user } = row;
  const step = verifyTotp(cipher.decrypt(pendingEnc), code, now, null);
  if (step === null) return wrongCode(db, session.id, session.failedCodes);

  await db
    .update(users)
    .set({ totpSecretEnc: pendingEnc, totpLastStep: step })
    .where(and(eq(users.id, user.id), isNull(users.totpSecretEnc)));
  return completeSession(db, session.id, user.id, now);
}

/**
 * "Später einrichten": completes the login without 2FA, for an account that has none. The
 * setup is offered again at every login until it is done.
 */
export async function skipTotpSetup(db: Database, token: string, now: Date): Promise<CodeResult> {
  const row = await pendingSession(db, token, now);
  if (!row || row.user.totpSecretEnc) return { error: EXPIRED, restart: true };
  return completeSession(db, row.session.id, row.user.id, now);
}

/** Ends every session of an account, e.g. when its password is reset. */
export async function endSessionsOf(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
