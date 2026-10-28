// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newPasswordProblem } from './pwned';

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex').toUpperCase();

/** Answers like api.pwnedpasswords.com/range/<prefix>: "SUFFIX:COUNT" per line. */
function rangeFor(password: string, count: number) {
  const hash = sha1(password);
  return vi.fn(
    async (_url: string) =>
      new Response(`0000000000000000000000000000000000A:1\r\n${hash.slice(5)}:${count}\r\n`),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('newPasswordProblem', () => {
  it('checks the rules first, without asking the leak database', async () => {
    const fetch = rangeFor('kurz', 0);
    expect(await newPasswordProblem('kurz', 'peter@agentur.de', fetch)).toBe(
      'Mindestens 10 Zeichen.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a password from a known leak, sending only the first 5 characters of its hash', async () => {
    const fetch = rangeFor('passwort-123', 21_345);
    expect(await newPasswordProblem('passwort-123', 'peter@agentur.de', fetch)).toBe(
      'Dieses Passwort ist aus Datenlecks bekannt (21.345-mal). Bitte ein anderes wählen.',
    );
    expect(fetch).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${sha1('passwort-123').slice(0, 5)}`,
      expect.objectContaining({ headers: { 'Add-Padding': 'true' } }),
    );
  });

  it('accepts a password that is not in the leaks; padding lines with count 0 do not count', async () => {
    const fetch = vi.fn(
      async () => new Response(`${sha1('sonne-wolke-42').slice(5)}:0\r\nABC:3\r\n`),
    );
    expect(await newPasswordProblem('sonne-wolke-42', 'peter@agentur.de', fetch)).toBeNull();
  });

  it('does not block anyone when the leak database cannot be reached', async () => {
    const down = vi.fn(async () => new Response('', { status: 503 }));
    const offline = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await newPasswordProblem('sonne-wolke-42', undefined, down)).toBeNull();
    expect(await newPasswordProblem('sonne-wolke-42', undefined, offline)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('can be switched off for tests, which never reach outside services', async () => {
    vi.stubEnv('PWNED_CHECK', 'off');
    const fetch = rangeFor('passwort-123', 5);
    expect(await newPasswordProblem('passwort-123', undefined, fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
