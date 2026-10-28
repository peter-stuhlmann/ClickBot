import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  totpStep,
  verifyTotp,
} from './totp';

// RFC 6238, appendix B: the SHA-1 seed "12345678901234567890" in base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const at = (seconds: number) => new Date(seconds * 1000);

describe('totpCode', () => {
  // The RFC lists 8 digits; authenticator apps show the last 6.
  it.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
  ])('matches the RFC test vector at %d s', (seconds, code) => {
    expect(totpCode(RFC_SECRET, totpStep(at(seconds)))).toBe(code);
  });
});

describe('verifyTotp', () => {
  const now = at(1_111_111_111);
  const step = totpStep(now);

  it('accepts the current code and returns its time step', () => {
    expect(verifyTotp(RFC_SECRET, '050471', now, null)).toBe(step);
  });

  it('accepts the code of the step before and after, for clocks that are a bit off', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now, null)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), now, null)).toBeNull();
  });

  it('accepts a code only once', () => {
    expect(verifyTotp(RFC_SECRET, '050471', now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now, step)).toBe(step + 1);
  });

  it.each(['', '12345', '1234567', 'abcdef', '05-04-71'])(
    'rejects the malformed code %j',
    (code) => {
      expect(verifyTotp(RFC_SECRET, code, now, null)).toBeNull();
    },
  );

  it('ignores spaces that apps show in the middle of a code', () => {
    expect(verifyTotp(RFC_SECRET, '050 471', now, null)).toBe(step);
  });
});

describe('secrets', () => {
  it('creates a new random 160-bit secret each time', () => {
    const a = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(generateTotpSecret()).not.toBe(a);
  });

  it('encodes and decodes base32 like RFC 4648', () => {
    expect(base32Encode(Buffer.from('12345678901234567890'))).toBe(RFC_SECRET);
    expect(base32Decode('gezd gnbv')).toEqual(Buffer.from('12345'));
    expect(() => base32Decode('GEZD1')).toThrow('Ungültiges Base32');
  });

  it('builds the address for the QR code of authenticator apps', () => {
    expect(otpauthUri(RFC_SECRET, 'peter@agentur.de')).toBe(
      'otpauth://totp/Click-Bot:peter%40agentur.de?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Click-Bot&algorithm=SHA1&digits=6&period=30',
    );
  });
});
