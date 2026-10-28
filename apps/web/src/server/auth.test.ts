// @vitest-environment node
import type { SessionInfo } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { nextAuthStep, sessionCookieOptions } from './auth';

const session = (overrides: Partial<SessionInfo> = {}): SessionInfo => ({
  user: { id: 'u1', name: 'Peter', email: 'peter@agentur.de', role: 'admin' },
  complete: true,
  hasTotp: true,
  ...overrides,
});

describe('nextAuthStep', () => {
  it.each([
    ['without a session', null, '/anmelden'],
    ['after the password, with 2FA set up', session({ complete: false }), '/anmelden/code'],
    [
      'after the password, without 2FA yet',
      session({ complete: false, hasTotp: false }),
      '/anmelden/2fa',
    ],
    ['when signed in', session(), '/'],
  ])('leads %s to %s', (_case, input, path) => {
    expect(nextAuthStep(input)).toBe(path);
  });
});

describe('sessionCookieOptions', () => {
  it('keeps the cookie away from scripts and other sites', () => {
    expect(sessionCookieOptions(true, true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 14 * 86_400,
    });
  });

  it('lets the password step expire after 15 minutes and allows http locally', () => {
    expect(sessionCookieOptions(false, false)).toMatchObject({ maxAge: 900, secure: false });
  });
});
