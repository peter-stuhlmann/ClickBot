import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import { ValidationError } from './errors';
import { claimRecordingSession, createRecordingSession, endRecordingSession } from './recordings';
import { users } from './schema';

const now = new Date('2026-11-05T12:30:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);

async function user(email = 'peter@beispiel.de') {
  const [row] = await db
    .insert(users)
    .values({ email, name: 'Peter', passwordHash: 'scrypt$x$y', role: 'admin' })
    .returning({ id: users.id });
  return (row as { id: string }).id;
}

describe('recording sessions', () => {
  it('opens the live browser once for the token it handed out', async () => {
    const userId = await user();
    const { id, token } = await createRecordingSession(
      db,
      { userId, startUrl: 'https://beispiel.de/kontakt' },
      now,
    );

    expect(await claimRecordingSession(db, token, later(5))).toEqual({
      id,
      userId,
      startUrl: 'https://beispiel.de/kontakt',
    });
    // A token works once: a copied link cannot open a second browser.
    expect(await claimRecordingSession(db, token, later(6))).toBeNull();
  });

  it('refuses an unknown or expired token', async () => {
    const userId = await user();
    const { token } = await createRecordingSession(
      db,
      { userId, startUrl: 'https://beispiel.de' },
      now,
    );
    expect(await claimRecordingSession(db, 'erfunden', later(1))).toBeNull();
    expect(await claimRecordingSession(db, token, later(121))).toBeNull();
  });

  it('ends the older session of the same user when a new one starts', async () => {
    const userId = await user();
    const first = await createRecordingSession(db, { userId, startUrl: 'https://eins.de' }, now);
    await createRecordingSession(db, { userId, startUrl: 'https://zwei.de' }, later(10));
    expect(await claimRecordingSession(db, first.token, later(11))).toBeNull();
  });

  it('cannot be claimed after it ended', async () => {
    const userId = await user();
    const { id, token } = await createRecordingSession(
      db,
      { userId, startUrl: 'https://beispiel.de' },
      now,
    );
    await endRecordingSession(db, id, later(1));
    expect(await claimRecordingSession(db, token, later(2))).toBeNull();
  });

  it('only records web addresses', async () => {
    const userId = await user();
    await expect(
      createRecordingSession(db, { userId, startUrl: 'file:///etc/passwd' }, now),
    ).rejects.toThrow(ValidationError);
  });
});
