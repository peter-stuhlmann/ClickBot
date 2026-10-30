import { eq } from 'drizzle-orm';
import { nameIssues } from './auth';
import type { Database } from './client';
import { NotFoundError, ValidationError, type ValidationIssue } from './errors';
import { isUuid } from './ids';
import { userAvatars, users } from './schema';

/**
 * The own profile: name and picture. E-mail and role are not part of it; the e-mail is the
 * login, and only an invitation sets the role.
 */

/** Same limit as the CHECK on `user_avatars`; the browser shrinks pictures far below it. */
export const AVATAR_MAX_BYTES = 512 * 1024;

export type AvatarType = 'image/png' | 'image/jpeg' | 'image/webp';

const startsWith = (data: Uint8Array, bytes: number[], offset = 0) =>
  data.length >= offset + bytes.length && bytes.every((byte, i) => data[offset + i] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** The type by the first bytes, not by what the browser claims; null for anything else. */
export function avatarType(data: Uint8Array): AvatarType | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, ascii('RIFF')) && startsWith(data, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

export type ProfileInput = {
  name: string;
  /** A new picture; null removes it, omitted keeps it. */
  avatar?: Uint8Array | null;
};

function avatarIssues(avatar: Uint8Array): ValidationIssue[] {
  if (!avatarType(avatar)) {
    return [{ path: 'avatar', message: 'Bitte ein Bild als PNG, JPEG oder WebP wählen.' }];
  }
  if (avatar.length > AVATAR_MAX_BYTES) {
    return [{ path: 'avatar', message: 'Das Bild ist zu groß (höchstens 512 KB).' }];
  }
  return [];
}

/** Changes the name and the picture of an account together, or nothing at all. */
export async function updateProfile(
  db: Database,
  userId: string,
  input: ProfileInput,
  now: Date,
): Promise<void> {
  const issues = [...nameIssues(input.name), ...(input.avatar ? avatarIssues(input.avatar) : [])];
  if (issues.length > 0) throw new ValidationError(issues);
  if (!isUuid(userId)) throw new NotFoundError('Konto', userId);

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ name: input.name.trim() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updated.length === 0) throw new NotFoundError('Konto', userId);

    if (input.avatar === null) {
      await tx.delete(userAvatars).where(eq(userAvatars.userId, userId));
    } else if (input.avatar) {
      const avatar = {
        contentType: avatarType(input.avatar) as AvatarType,
        data: Buffer.from(input.avatar),
        updatedAt: now,
      };
      await tx
        .insert(userAvatars)
        .values({ userId, ...avatar })
        .onConflictDoUpdate({ target: userAvatars.userId, set: avatar });
    }
  });
}

export type Avatar = { contentType: string; data: Buffer; updatedAt: Date };

/** The picture of an account, or null. */
export async function getAvatar(db: Database, userId: string): Promise<Avatar | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({
      contentType: userAvatars.contentType,
      data: userAvatars.data,
      updatedAt: userAvatars.updatedAt,
    })
    .from(userAvatars)
    .where(eq(userAvatars.userId, userId));
  return row ?? null;
}
