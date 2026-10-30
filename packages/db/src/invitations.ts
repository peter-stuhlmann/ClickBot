import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  accountIssues,
  endSessionsOf,
  hashToken,
  newToken,
  normaliseEmail,
  openSession,
  type Role,
} from './auth';
import type { Database } from './client';
import { ValidationError } from './errors';
import { isUuid } from './ids';
import { hashPassword } from './passwords';
import { invitations, userAvatars, users } from './schema';

/**
 * New accounts come by invitation link from an admin ("Einstellungen → Team"). A link for an
 * address that already has an account resets its password and 2FA: there is no e-mail yet, so
 * this is also the way back in after a forgotten password or a lost phone.
 */

export const INVITATION_DAYS = 7;
const DAY_MS = 86_400_000;
const ROLES: readonly Role[] = ['admin', 'member'];
const GONE = 'Diese Einladung ist abgelaufen oder wurde schon benutzt.';

const sameEmail = (email: string) => sql`lower(${users.email}) = ${email}`;

export async function createInvitation(
  db: Database,
  input: { email: string; role: Role; createdBy: string | null },
  now: Date,
): Promise<{ id: string; token: string }> {
  const email = normaliseEmail(input.email);
  const emailIssue = accountIssues({ name: 'x', email, password: 'gueltig-12345' });
  if (emailIssue.length > 0) throw new ValidationError(emailIssue);
  if (!ROLES.includes(input.role)) {
    throw new ValidationError([{ path: 'role', message: 'Unbekannte Rolle.' }]);
  }

  const token = newToken();
  return db.transaction(async (tx) => {
    // One open link per address: the newest one counts.
    await tx
      .delete(invitations)
      .where(and(sql`lower(${invitations.email}) = ${email}`, isNull(invitations.acceptedAt)));
    const [invitation] = await tx
      .insert(invitations)
      .values({
        tokenHash: hashToken(token),
        email,
        role: input.role,
        createdBy: input.createdBy,
        createdAt: now,
        expiresAt: new Date(now.getTime() + INVITATION_DAYS * DAY_MS),
      })
      .returning({ id: invitations.id });
    return { id: (invitation as { id: string }).id, token };
  });
}

function openInvitation(token: string, now: Date) {
  return and(
    eq(invitations.tokenHash, hashToken(token)),
    isNull(invitations.acceptedAt),
    gt(invitations.expiresAt, now),
  );
}

export type InvitationInfo = {
  email: string;
  role: Role;
  /** The address has an account already: accepting resets its password and 2FA. */
  resetsAccount: boolean;
};

/** The invitation behind a link, or null if it is unknown, used or expired. */
export async function getInvitation(
  db: Database,
  token: string,
  now: Date,
): Promise<InvitationInfo | null> {
  const [invitation] = await db.select().from(invitations).where(openInvitation(token, now));
  if (!invitation) return null;
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sameEmail(invitation.email));
  return { email: invitation.email, role: invitation.role, resetsAccount: existing !== undefined };
}

/**
 * Creates the account (or resets the existing one) and opens a session that still needs the 2FA
 * setup. The link works only once.
 */
export async function acceptInvitation(
  db: Database,
  token: string,
  input: { name: string; password: string },
  now: Date,
): Promise<{ token: string }> {
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(openInvitation(token, now))
      .for('update');
    if (!invitation) throw new ValidationError([{ path: 'form', message: GONE }]);

    const issues = accountIssues({ ...input, email: invitation.email });
    if (issues.length > 0) throw new ValidationError(issues);

    const values = {
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: invitation.role,
      totpSecretEnc: null,
      totpLastStep: null,
      failedLogins: 0,
      lockedUntil: null,
    };
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sameEmail(invitation.email));
    let userId: string;
    if (existing) {
      await tx.update(users).set(values).where(eq(users.id, existing.id));
      await endSessionsOf(tx, existing.id);
      userId = existing.id;
    } else {
      const [created] = await tx
        .insert(users)
        .values({ ...values, email: invitation.email })
        .returning({ id: users.id });
      userId = (created as { id: string }).id;
    }

    await tx.update(invitations).set({ acceptedAt: now }).where(eq(invitations.id, invitation.id));
    return { token: await openSession(tx, userId, false, now) };
  });
}

export type OpenInvitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  expiresAt: Date;
};

/** Links that can still be used, newest first. The tokens exist only in the links. */
export async function listOpenInvitations(db: Database, now: Date): Promise<OpenInvitation[]> {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(and(isNull(invitations.acceptedAt), gt(invitations.expiresAt, now)))
    .orderBy(desc(invitations.createdAt));
}

export async function revokeInvitation(db: Database, id: string): Promise<void> {
  if (!isUuid(id)) return;
  await db.delete(invitations).where(eq(invitations.id, id));
}

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  hasTotp: boolean;
  createdAt: Date;
  /** When the profile picture last changed; null without one. */
  avatarUpdatedAt: Date | null;
};

/** The accounts of the team, by name. */
export async function listUsers(db: Database): Promise<TeamMember[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      totpSecretEnc: users.totpSecretEnc,
      createdAt: users.createdAt,
      avatarUpdatedAt: userAvatars.updatedAt,
    })
    .from(users)
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .orderBy(asc(users.name));
  return rows.map(({ totpSecretEnc, ...user }) => ({ ...user, hasTotp: totpSecretEnc !== null }));
}
