// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toInvitation, toTeamMember } from './team-view';

describe('team view', () => {
  it('names roles and 2FA state of an account', () => {
    expect(
      toTeamMember({
        id: 'u1',
        name: 'Anna',
        email: 'anna@agentur.de',
        role: 'member',
        hasTotp: false,
        createdAt: new Date(),
      }),
    ).toEqual({
      id: 'u1',
      name: 'Anna',
      email: 'anna@agentur.de',
      role: 'Mitglied',
      twoFactor: false,
    });
  });

  it('shows until when an invitation works, in German time', () => {
    expect(
      toInvitation({
        id: 'i1',
        email: 'ben@agentur.de',
        role: 'admin',
        createdAt: new Date('2026-11-05T13:30:00Z'),
        expiresAt: new Date('2026-11-12T13:30:00Z'),
      }),
    ).toEqual({ id: 'i1', email: 'ben@agentur.de', role: 'Admin', expires: '12.11. 14:30' });
  });
});
