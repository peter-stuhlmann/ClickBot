import 'server-only';
import { createCipher, parseKey, type Cipher } from '@click-bot/db';

let cipher: Cipher | undefined;

/** AES-256-GCM with SECRETS_KEY, e.g. for 2FA secrets. Throws a clear message without the key. */
export function getCipher(): Cipher {
  cipher ??= createCipher(parseKey(process.env.SECRETS_KEY));
  return cipher;
}
