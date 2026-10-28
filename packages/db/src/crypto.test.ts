import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCipher, parseKey } from './crypto';

const key = randomBytes(32);
const cipher = createCipher(key);

describe('createCipher', () => {
  it('decrypts what it encrypted, including umlauts and emoji', () => {
    const secret = 'Pässwört-🔑-123';
    expect(cipher.decrypt(cipher.encrypt(secret))).toBe(secret);
  });

  it('never stores the plain text', () => {
    expect(cipher.encrypt('s3cr3t-pw')).not.toContain('s3cr3t-pw');
  });

  it('produces a different ciphertext each time, so equal secrets are not recognisable', () => {
    expect(cipher.encrypt('gleich')).not.toBe(cipher.encrypt('gleich'));
  });

  it('marks the format version so the scheme can be changed later', () => {
    expect(cipher.encrypt('x').startsWith('v1:')).toBe(true);
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const [version, iv, tag, data] = cipher.encrypt('s3cr3t-pw').split(':') as [
      string,
      string,
      string,
      string,
    ];
    const flipped = Buffer.from(data, 'base64');
    flipped[0] = (flipped[0] as number) ^ 0xff;
    const tampered = [version, iv, tag, flipped.toString('base64')].join(':');
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it('cannot be decrypted with another key', () => {
    const other = createCipher(randomBytes(32));
    expect(() => other.decrypt(cipher.encrypt('s3cr3t-pw'))).toThrow();
  });

  it.each(['', 'v2:a:b:c', 'v1:nur:drei', 'kein-format'])('rejects malformed input %j', (input) => {
    expect(() => cipher.decrypt(input)).toThrow('Ungültiges Format für verschlüsselten Wert.');
  });

  it('refuses a key that is not 32 bytes long', () => {
    expect(() => createCipher(randomBytes(16))).toThrow('SECRETS_KEY muss 32 Bytes lang sein');
  });
});

describe('parseKey', () => {
  it('reads a base64-encoded 32-byte key', () => {
    const raw = randomBytes(32);
    expect(parseKey(raw.toString('base64')).equals(raw)).toBe(true);
  });

  it('explains how to create a key when it is missing', () => {
    expect(() => parseKey(undefined)).toThrow('openssl rand -base64 32');
  });
});
