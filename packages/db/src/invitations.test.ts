import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import { confirmTotpSetup, getSession, login, registerFirstAdmin, startTotpSetup } from './auth';
import { createCipher } from './crypto';
import { ValidationError } from './errors';
import {
  acceptInvitation,
  createInvitation,
  getInvitation,
  listOpenInvitations,
  listUsers,
  revokeInvitation,
} from './invitations';
import { totpCode, totpStep } from './totp';

const cipher = createCipher(randomBytes(32));
const now = new Date('2026-11-05T12:30:00Z');
const days = (d: number) => new Date(now.getTime() + d * 86_400_000);

async function adminId() {
  await registerFirstAdmin(
    db,
    { name: 'Peter Stuhlmann', email: 'peter@agentur.de', password: 'sonne-wolke-42' },
    now,
  );
  const [admin] = await listUsers(db);
  return admin?.id as string;
}

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

const anna = { name: 'Anna Schmidt', password: 'regen-bogen-77' };

describe('invitations', () => {
  it('invite a new member who then chooses name and password', async () => {
    const createdBy = await adminId();
    const { token } = await createInvitation(
      db,
      { email: ' Anna@Agentur.de ', role: 'member', createdBy },
      now,
    );

    expect(await getInvitation(db, token, now)).toEqual({
      email: 'anna@agentur.de',
      role: 'member',
      resetsAccount: false,
    });
    const { token: session } = await acceptInvitation(db, token, anna, now);

    expect(await getSession(db, session, now)).toMatchObject({
      user: { name: 'Anna Schmidt', email: 'anna@agentur.de', role: 'member' },
      complete: false,
      hasTotp: false,
    });
    expect(await getInvitation(db, token, now)).toBeNull();
  });

  it('reset password and 2FA of an existing account, e.g. after a lost phone', async () => {
    const createdBy = await adminId();
    const first = await createInvitation(
      db,
      { email: 'anna@agentur.de', role: 'member', createdBy },
      now,
    );
    const { token: session } = await acceptInvitation(db, first.token, anna, now);
    const setup = await startTotpSetup(db, cipher, session, now);
    const complete = await confirmTotpSetup(
      db,
      cipher,
      session,
      totpCode(setup?.secret as string, totpStep(now)),
      now,
    );

    const reset = await createInvitation(
      db,
      { email: 'anna@agentur.de', role: 'admin', createdBy },
      now,
    );
    expect(await getInvitation(db, reset.token, now)).toMatchObject({ resetsAccount: true });
    await acceptInvitation(
      db,
      reset.token,
      { name: 'Anna S.', password: 'neues-passwort-88' },
      now,
    );

    // The old session and the old password are gone, 2FA has to be set up again.
    expect(await getSession(db, (complete as { token: string }).token, now)).toBeNull();
    expect(await login(db, { email: 'anna@agentur.de', password: anna.password }, now)).toEqual({
      error: 'E-Mail oder Passwort ist falsch.',
    });
    const users = await listUsers(db);
    expect(users.find((user) => user.email === 'anna@agentur.de')).toMatchObject({
      name: 'Anna S.',
      role: 'admin',
      hasTotp: false,
    });
  });

  it('work once and for 7 days', async () => {
    const createdBy = await adminId();
    const used = await createInvitation(
      db,
      { email: 'anna@agentur.de', role: 'member', createdBy },
      now,
    );
    await acceptInvitation(db, used.token, anna, now);
    const old = await createInvitation(
      db,
      { email: 'ben@agentur.de', role: 'member', createdBy },
      now,
    );
    const gone = {
      path: 'form',
      message: 'Diese Einladung ist abgelaufen oder wurde schon benutzt.',
    };

    expect(await issuesOf(acceptInvitation(db, used.token, anna, now))).toEqual([gone]);
    expect(await getInvitation(db, old.token, days(8))).toBeNull();
    expect(await issuesOf(acceptInvitation(db, old.token, anna, days(8)))).toEqual([gone]);
    expect(await issuesOf(acceptInvitation(db, 'unbekannt', anna, now))).toEqual([gone]);
  });

  it('check name and password when they are accepted', async () => {
    const createdBy = await adminId();
    const { token } = await createInvitation(
      db,
      { email: 'anna@agentur.de', role: 'member', createdBy },
      now,
    );
    expect(
      await issuesOf(acceptInvitation(db, token, { name: '', password: 'Anna-2026-test' }, now)),
    ).toEqual([
      { path: 'name', message: 'Name fehlt.' },
      { path: 'password', message: 'Das Passwort darf deine E-Mail-Adresse nicht enthalten.' },
    ]);
    expect(await getInvitation(db, token, now)).not.toBeNull();
  });

  it('replace an older open invitation to the same address', async () => {
    const createdBy = await adminId();
    const older = await createInvitation(
      db,
      { email: 'anna@agentur.de', role: 'member', createdBy },
      now,
    );
    await createInvitation(db, { email: 'ANNA@agentur.de', role: 'admin', createdBy }, now);

    expect(await getInvitation(db, older.token, now)).toBeNull();
    expect((await listOpenInvitations(db, now)).map((open) => [open.email, open.role])).toEqual([
      ['anna@agentur.de', 'admin'],
    ]);
  });

  it('can be revoked', async () => {
    const createdBy = await adminId();
    const { token, id } = await createInvitation(
      db,
      { email: 'anna@agentur.de', role: 'member', createdBy },
      now,
    );
    await revokeInvitation(db, 'kein-uuid');
    expect(await getInvitation(db, token, now)).not.toBeNull();
    await revokeInvitation(db, id);
    expect(await getInvitation(db, token, now)).toBeNull();
    expect(await listOpenInvitations(db, now)).toEqual([]);
  });

  it('need a valid address and role', async () => {
    const createdBy = await adminId();
    expect(
      await issuesOf(createInvitation(db, { email: 'anna', role: 'member', createdBy }, now)),
    ).toEqual([{ path: 'email', message: 'Bitte eine gültige E-Mail-Adresse eingeben.' }]);
    expect(
      await issuesOf(
        createInvitation(db, { email: 'anna@agentur.de', role: 'chef' as never, createdBy }, now),
      ),
    ).toEqual([{ path: 'role', message: 'Unbekannte Rolle.' }]);
  });

  it('list the open ones without their tokens, newest first', async () => {
    const createdBy = await adminId();
    await createInvitation(db, { email: 'anna@agentur.de', role: 'member', createdBy }, now);
    await createInvitation(db, { email: 'ben@agentur.de', role: 'admin', createdBy }, days(1));
    await createInvitation(db, { email: 'alt@agentur.de', role: 'member', createdBy }, days(-8));

    const open = await listOpenInvitations(db, days(1));
    expect(open.map((invite) => invite.email)).toEqual(['ben@agentur.de', 'anna@agentur.de']);
    expect(JSON.stringify(open)).not.toMatch(/token/i);
    expect(open[0]).toMatchObject({ role: 'admin', expiresAt: days(8) });
  });
});

describe('listUsers', () => {
  it('lists the accounts by name with role and 2FA state, never the password hash', async () => {
    await adminId();
    const users = await listUsers(db);
    expect(users).toEqual([
      {
        id: expect.any(String),
        name: 'Peter Stuhlmann',
        email: 'peter@agentur.de',
        role: 'admin',
        hasTotp: false,
        createdAt: expect.any(Date),
        avatarUpdatedAt: null,
      },
    ]);
  });
});
