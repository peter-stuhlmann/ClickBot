import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import {
  confirmTotpSetup,
  deleteExpiredSessions,
  getSession,
  hasUsers,
  login,
  logout,
  registerFirstAdmin,
  skipTotpSetup,
  startTotpSetup,
  verifyLoginCode,
} from './auth';
import { createCipher } from './crypto';
import { ValidationError } from './errors';
import { sessions, users } from './schema';
import { totpCode, totpStep } from './totp';

const cipher = createCipher(randomBytes(32));
const now = new Date('2026-11-05T12:30:00Z');
const minutes = (m: number) => new Date(now.getTime() + m * 60_000);

const admin = { name: 'Peter Stuhlmann', email: 'Peter@Agentur.de', password: 'sonne-wolke-42' };

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

/** Registers the admin and sets up 2FA; returns the secret and a complete session. */
async function adminWith2fa() {
  const { token } = await registerFirstAdmin(db, admin, now);
  const setup = await startTotpSetup(db, cipher, token, now);
  const secret = setup?.secret as string;
  const done = await confirmTotpSetup(db, cipher, token, totpCode(secret, totpStep(now)), now);
  if (!('token' in done)) throw new Error(done.error);
  return { secret, token: done.token };
}

describe('registerFirstAdmin', () => {
  it('creates the first account as admin, with a session that still needs 2FA', async () => {
    expect(await hasUsers(db)).toBe(false);
    const { token } = await registerFirstAdmin(db, admin, now);

    const [user] = await db.select().from(users);
    expect(user).toMatchObject({
      name: 'Peter Stuhlmann',
      email: 'peter@agentur.de',
      role: 'admin',
    });
    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(await getSession(db, token, now)).toEqual({
      user: {
        id: user?.id,
        name: 'Peter Stuhlmann',
        email: 'peter@agentur.de',
        role: 'admin',
        avatarUpdatedAt: null,
      },
      complete: false,
      hasTotp: false,
    });
  });

  it('is closed once an account exists: new accounts only by invitation', async () => {
    await registerFirstAdmin(db, admin, now);
    expect(
      await issuesOf(registerFirstAdmin(db, { ...admin, email: 'zweite@agentur.de' }, now)),
    ).toEqual([
      { path: 'form', message: 'Es gibt schon ein Konto. Neue Konten gibt es nur per Einladung.' },
    ]);
  });

  it('lets only one of two registrations at the same moment through', async () => {
    const results = await Promise.allSettled([
      registerFirstAdmin(db, admin, now),
      registerFirstAdmin(db, { ...admin, email: 'gleichzeitig@agentur.de' }, now),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('reports every problem of the form at once', async () => {
    expect(
      await issuesOf(
        registerFirstAdmin(db, { name: ' ', email: 'kein-at', password: 'kurz' }, now),
      ),
    ).toEqual([
      { path: 'name', message: 'Name fehlt.' },
      { path: 'email', message: 'Bitte eine gültige E-Mail-Adresse eingeben.' },
      { path: 'password', message: 'Mindestens 10 Zeichen.' },
    ]);
  });
});

describe('login', () => {
  it('opens a session that still needs the 2FA code', async () => {
    await adminWith2fa();
    const result = await login(db, { email: ' PETER@agentur.de ', password: admin.password }, now);
    expect('token' in result).toBe(true);
    const session = await getSession(db, (result as { token: string }).token, now);
    expect(session).toMatchObject({ complete: false, hasTotp: true });
  });

  it('gives the same answer for an unknown address and a wrong password', async () => {
    await adminWith2fa();
    const unknown = await login(db, { email: 'nobody@agentur.de', password: admin.password }, now);
    const wrong = await login(db, { email: admin.email, password: 'falsch-falsch-1' }, now);
    expect(unknown).toEqual({ error: 'E-Mail oder Passwort ist falsch.' });
    expect(wrong).toEqual(unknown);
  });

  it('locks the account for 15 minutes after 5 wrong passwords, even for the right one', async () => {
    await adminWith2fa();
    for (let i = 0; i < 4; i++) {
      await login(db, { email: admin.email, password: `falsch-${i}-passwort` }, now);
    }
    expect(await login(db, { email: admin.email, password: 'falsch-5-passwort' }, now)).toEqual({
      error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
    });
    expect(await login(db, { email: admin.email, password: admin.password }, minutes(10))).toEqual({
      error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
    });
    expect(
      'token' in (await login(db, { email: admin.email, password: admin.password }, minutes(16))),
    ).toBe(true);
  });

  it('starts counting wrong passwords anew after a successful login', async () => {
    await adminWith2fa();
    for (let i = 0; i < 4; i++) {
      await login(db, { email: admin.email, password: `falsch-${i}-passwort` }, now);
    }
    await login(db, { email: admin.email, password: admin.password }, now);
    await login(db, { email: admin.email, password: 'noch-einmal-falsch1' }, now);
    expect(
      'token' in (await login(db, { email: admin.email, password: admin.password }, now)),
    ).toBe(true);
  });
});

describe('verifyLoginCode', () => {
  async function passwordStep(at = now) {
    const result = await login(db, { email: admin.email, password: admin.password }, at);
    return (result as { token: string }).token;
  }

  it('completes the login with the current code and swaps the session token', async () => {
    const { secret } = await adminWith2fa();
    const later = minutes(1);
    const pending = await passwordStep(later);

    const result = await verifyLoginCode(
      db,
      cipher,
      pending,
      totpCode(secret, totpStep(later)),
      later,
    );

    expect('token' in result).toBe(true);
    const token = (result as { token: string }).token;
    expect(token).not.toBe(pending);
    expect(await getSession(db, pending, later)).toBeNull();
    expect(await getSession(db, token, later)).toMatchObject({ complete: true });
  });

  it('accepts a code only once', async () => {
    const { secret } = await adminWith2fa();
    const later = minutes(1);
    const code = totpCode(secret, totpStep(later));
    await verifyLoginCode(db, cipher, await passwordStep(later), code, later);

    expect(await verifyLoginCode(db, cipher, await passwordStep(later), code, later)).toEqual({
      error: 'Der Code stimmt nicht.',
    });
  });

  it('sends back to the start after 5 wrong codes', async () => {
    await adminWith2fa();
    const pending = await passwordStep(minutes(1));
    for (let i = 0; i < 4; i++) {
      expect(await verifyLoginCode(db, cipher, pending, '000000', minutes(1))).toEqual({
        error: 'Der Code stimmt nicht.',
      });
    }
    expect(await verifyLoginCode(db, cipher, pending, '000000', minutes(1))).toEqual({
      error: 'Zu viele falsche Codes. Bitte neu anmelden.',
      restart: true,
    });
    expect(await getSession(db, pending, minutes(1))).toBeNull();
  });

  it('refuses unknown, expired and already complete sessions', async () => {
    const { secret, token } = await adminWith2fa();
    const code = totpCode(secret, totpStep(minutes(1)));
    const restart = { error: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.', restart: true };

    expect(await verifyLoginCode(db, cipher, 'unbekannt', code, minutes(1))).toEqual(restart);
    expect(await verifyLoginCode(db, cipher, token, code, minutes(1))).toEqual(restart);
    const pending = await passwordStep();
    expect(await verifyLoginCode(db, cipher, pending, code, minutes(16))).toEqual(restart);
  });
});

describe('2FA setup', () => {
  it('keeps the same secret while the setup page is reloaded', async () => {
    const { token } = await registerFirstAdmin(db, admin, now);
    const first = await startTotpSetup(db, cipher, token, now);
    const again = await startTotpSetup(db, cipher, token, now);

    expect(first).toEqual({
      secret: expect.stringMatching(/^[A-Z2-7]{32}$/),
      email: 'peter@agentur.de',
    });
    expect(again).toEqual(first);
    const [session] = await db.select().from(sessions);
    expect(session?.pendingTotpEnc).not.toContain(first?.secret);
  });

  it('stores the secret encrypted once the first code is right', async () => {
    const { token } = await adminWith2fa();
    const [user] = await db.select().from(users);
    expect(user?.totpSecretEnc).toMatch(/^v1:/);
    expect(await getSession(db, token, now)).toMatchObject({ complete: true, hasTotp: true });
  });

  it('refuses a wrong first code and keeps the setup open', async () => {
    const { token } = await registerFirstAdmin(db, admin, now);
    await startTotpSetup(db, cipher, token, now);
    expect(await confirmTotpSetup(db, cipher, token, '000000', now)).toEqual({
      error: 'Der Code stimmt nicht.',
    });
    expect(await getSession(db, token, now)).toMatchObject({ complete: false, hasTotp: false });
  });

  it('is not offered again to an account that already has 2FA', async () => {
    await adminWith2fa();
    const pending = await login(db, { email: admin.email, password: admin.password }, minutes(1));
    const token = (pending as { token: string }).token;
    expect(await startTotpSetup(db, cipher, token, minutes(1))).toBeNull();
    expect(await confirmTotpSetup(db, cipher, token, '123456', minutes(1))).toEqual({
      error: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.',
      restart: true,
    });
  });
});

describe('sessions', () => {
  it('end with logout', async () => {
    const { token } = await adminWith2fa();
    await logout(db, token);
    expect(await getSession(db, token, now)).toBeNull();
  });

  it('expire after 14 days and are removed then', async () => {
    const { token } = await adminWith2fa();
    expect(await getSession(db, token, minutes(14 * 24 * 60 - 1))).not.toBeNull();
    expect(await getSession(db, token, minutes(14 * 24 * 60 + 1))).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('that nobody finished are removed by the clean-up', async () => {
    await adminWith2fa();
    await login(db, { email: admin.email, password: admin.password }, now);
    await deleteExpiredSessions(db, minutes(16));
    // The complete session (14 days) stays, the abandoned password step (15 minutes) goes.
    expect((await db.select().from(sessions)).map((row) => row.complete)).toEqual([true]);
  });

  it('are stored as a hash, never as the token from the cookie', async () => {
    const { token } = await adminWith2fa();
    const rows = await db.select().from(sessions);
    expect(rows.map((row) => row.id)).not.toContain(token);
    expect(rows[0]?.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('go with their account', async () => {
    const { token } = await adminWith2fa();
    await db.delete(users).where(eq(users.email, 'peter@agentur.de'));
    expect(await getSession(db, token, now)).toBeNull();
  });
});

describe('skipping the 2FA setup', () => {
  it('signs in without 2FA and swaps the session token', async () => {
    const { token } = await registerFirstAdmin(db, admin, now);
    const result = await skipTotpSetup(db, token, now);

    expect('token' in result).toBe(true);
    const complete = (result as { token: string }).token;
    expect(complete).not.toBe(token);
    expect(await getSession(db, token, now)).toBeNull();
    expect(await getSession(db, complete, now)).toMatchObject({ complete: true, hasTotp: false });
  });

  it('offers the setup again at the next login', async () => {
    const { token } = await registerFirstAdmin(db, admin, now);
    await skipTotpSetup(db, token, now);
    const next = await login(db, { email: admin.email, password: admin.password }, minutes(1));
    expect(await getSession(db, (next as { token: string }).token, minutes(1))).toMatchObject({
      complete: false,
      hasTotp: false,
    });
  });

  it('is not possible for an account with 2FA, which has to enter its code', async () => {
    await adminWith2fa();
    const pending = await login(db, { email: admin.email, password: admin.password }, minutes(1));
    expect(await skipTotpSetup(db, (pending as { token: string }).token, minutes(1))).toEqual({
      error: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.',
      restart: true,
    });
  });

  it('can be made up for later, from a session that is already complete', async () => {
    const { token } = await registerFirstAdmin(db, admin, now);
    const skipped = (await skipTotpSetup(db, token, now)) as { token: string };

    const setup = await startTotpSetup(db, cipher, skipped.token, now);
    expect(setup?.secret).toMatch(/^[A-Z2-7]{32}$/);
    const done = await confirmTotpSetup(
      db,
      cipher,
      skipped.token,
      totpCode(setup?.secret as string, totpStep(now)),
      now,
    );

    const token2 = (done as { token: string }).token;
    expect(await getSession(db, token2, now)).toMatchObject({ complete: true, hasTotp: true });
    expect(await getSession(db, skipped.token, now)).toBeNull();
  });
});
