import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

export type Cipher = {
  encrypt(plainText: string): string;
  decrypt(stored: string): string;
};

/** Reads SECRETS_KEY: 32 random bytes, base64-encoded. */
export function parseKey(value: string | undefined): Buffer {
  if (!value) {
    throw new Error('SECRETS_KEY fehlt. Erzeugen mit: openssl rand -base64 32');
  }
  return Buffer.from(value, 'base64');
}

/**
 * AES-256-GCM with a random IV per value. Stored format: `v1:<iv>:<auth tag>:<ciphertext>`,
 * each part base64. GCM's auth tag makes any modification fail on decrypt.
 */
export function createCipher(key: Buffer): Cipher {
  if (key.length !== 32) {
    throw new Error(`SECRETS_KEY muss 32 Bytes lang sein, ist aber ${key.length} Bytes lang.`);
  }

  return {
    encrypt(plainText) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const data = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
      return [VERSION, iv, cipher.getAuthTag(), data].map(toBase64).join(':');
    },

    decrypt(stored) {
      const parts = stored.split(':');
      if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error('Ungültiges Format für verschlüsselten Wert.');
      }
      const [iv, tag, data] = parts.slice(1).map((part) => Buffer.from(part, 'base64')) as [
        Buffer,
        Buffer,
        Buffer,
      ];
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    },
  };
}

function toBase64(part: string | Buffer): string {
  return typeof part === 'string' ? part : part.toString('base64');
}
