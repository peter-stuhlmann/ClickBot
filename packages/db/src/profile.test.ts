import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import { getSession, registerFirstAdmin } from './auth';
import { NotFoundError, ValidationError } from './errors';
import { listUsers } from './invitations';
import { AVATAR_MAX_BYTES, avatarType, getAvatar, updateProfile } from './profile';
import { userAvatars } from './schema';

const now = new Date('2026-11-05T12:30:00Z');
// Within the 15 minutes of the session that still needs 2FA.
const later = new Date('2026-11-05T12:40:00Z');
const UNKNOWN = '00000000-0000-0000-0000-000000000000';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const WEBP = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8 ')]);
const SVG = new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

/** An account with a session, so the tests can read what the sidebar gets. */
async function account() {
  const { token } = await registerFirstAdmin(
    db,
    { name: 'Peter Stuhlmann', email: 'peter@agentur.de', password: 'sonne-wolke-42' },
    now,
  );
  const session = await getSession(db, token, now);
  if (!session) throw new Error('no session');
  return { userId: session.user.id, token };
}

describe('avatarType', () => {
  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['WebP', WEBP, 'image/webp'],
  ])('recognises %s by its first bytes', (_name, data, type) => {
    expect(avatarType(data)).toBe(type);
  });

  it.each([
    ['SVG, which could carry script', SVG],
    ['an empty file', new Uint8Array()],
    ['a RIFF file that is no WebP (WAV)', new Uint8Array(Buffer.from('RIFF\0\0\0\0WAVEfmt '))],
  ])('refuses %s', (_name, data) => {
    expect(avatarType(data)).toBeNull();
  });
});

describe('updateProfile', () => {
  it('changes the name, trimmed; the sidebar shows it with the next request', async () => {
    const { userId, token } = await account();
    await updateProfile(db, userId, { name: '  Peter S. ' }, now);
    expect((await getSession(db, token, now))?.user.name).toBe('Peter S.');
  });

  it('refuses an empty or too long name', async () => {
    const { userId } = await account();
    expect(await issuesOf(updateProfile(db, userId, { name: '   ' }, now))).toEqual([
      { path: 'name', message: 'Name fehlt.' },
    ]);
    expect(await issuesOf(updateProfile(db, userId, { name: 'x'.repeat(121) }, now))).toEqual([
      { path: 'name', message: 'Name ist zu lang (höchstens 120 Zeichen).' },
    ]);
  });

  it('stores a picture with its type and tells the session when it changed', async () => {
    const { userId, token } = await account();
    expect((await getSession(db, token, now))?.user.avatarUpdatedAt).toBeNull();

    await updateProfile(db, userId, { name: 'Peter Stuhlmann', avatar: PNG }, now);
    const avatar = await getAvatar(db, userId);
    expect(avatar?.contentType).toBe('image/png');
    expect(new Uint8Array(avatar?.data ?? [])).toEqual(PNG);
    expect((await getSession(db, token, now))?.user.avatarUpdatedAt).toEqual(now);

    // A new picture replaces the old one and gets a new time, so browsers load it again.
    await updateProfile(db, userId, { name: 'Peter Stuhlmann', avatar: JPEG }, later);
    expect((await getAvatar(db, userId))?.contentType).toBe('image/jpeg');
    expect((await getSession(db, token, later))?.user.avatarUpdatedAt).toEqual(later);
    expect(await db.select().from(userAvatars)).toHaveLength(1);
  });

  it('keeps the picture when none is given, and removes it with null', async () => {
    const { userId } = await account();
    await updateProfile(db, userId, { name: 'Peter Stuhlmann', avatar: WEBP }, now);
    await updateProfile(db, userId, { name: 'Peter' }, later);
    expect((await getAvatar(db, userId))?.contentType).toBe('image/webp');

    await updateProfile(db, userId, { name: 'Peter', avatar: null }, later);
    expect(await getAvatar(db, userId)).toBeNull();
  });

  it('refuses other files and pictures over the limit, and changes nothing then', async () => {
    const { userId, token } = await account();
    expect(await issuesOf(updateProfile(db, userId, { name: '', avatar: SVG }, now))).toEqual([
      { path: 'name', message: 'Name fehlt.' },
      { path: 'avatar', message: 'Bitte ein Bild als PNG, JPEG oder WebP wählen.' },
    ]);
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(PNG);
    expect(await issuesOf(updateProfile(db, userId, { name: 'Neu', avatar: big }, now))).toEqual([
      { path: 'avatar', message: 'Das Bild ist zu groß (höchstens 512 KB).' },
    ]);
    expect((await getSession(db, token, now))?.user.name).toBe('Peter Stuhlmann');
    expect(await getAvatar(db, userId)).toBeNull();
  });

  it('refuses an account that does not exist', async () => {
    await expect(updateProfile(db, UNKNOWN, { name: 'Niemand' }, now)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await getAvatar(db, UNKNOWN)).toBeNull();
  });

  it('lists the team with the time of each picture', async () => {
    const { userId } = await account();
    await updateProfile(db, userId, { name: 'Peter Stuhlmann', avatar: PNG }, now);
    expect(await listUsers(db)).toMatchObject([{ id: userId, avatarUpdatedAt: now }]);
  });
});

describe('user_avatars constraints', () => {
  it('rejects a type other than PNG, JPEG or WebP even without the repository', async () => {
    const { userId } = await account();
    await expect(
      db.insert(userAvatars).values({
        userId,
        contentType: 'image/svg+xml',
        data: Buffer.from(SVG),
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });
});
