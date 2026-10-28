import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords';

describe('passwords', () => {
  it('stores a salted scrypt hash, never the password', async () => {
    const stored = await hashPassword('sonne-wolke-42');
    expect(stored).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    expect(stored).not.toContain('sonne');
    expect(await hashPassword('sonne-wolke-42')).not.toBe(stored);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await hashPassword('sonne-wolke-42');
    expect(await verifyPassword('sonne-wolke-42', stored)).toBe(true);
    expect(await verifyPassword('sonne-wolke-43', stored)).toBe(false);
  });

  it('reads hashes made by seo-analyse (same format and parameters)', async () => {
    // Exactly what hashPassword in seo-analyse src/lib/auth.ts does.
    const salt = randomBytes(16);
    const hash = scryptSync('test-passwort-1', salt, 64, { N: 16384, r: 8, p: 1 });
    const fromSeoAnalyse = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
    expect(await verifyPassword('test-passwort-1', fromSeoAnalyse)).toBe(true);
  });

  it.each([
    ['a placeholder that is no hash', '!demo-no-login'],
    ['an empty value', ''],
    ['a hash of another kind', 'bcrypt$abc$def'],
    ['a cut-off hash', 'scrypt$c2FsdA$'],
  ])('refuses %s', async (_case, stored) => {
    expect(await verifyPassword('sonne-wolke-42', stored)).toBe(false);
  });
});
