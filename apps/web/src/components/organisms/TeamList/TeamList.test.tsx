import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamList } from './TeamList';

const members = [
  { id: 'u1', name: 'Peter Stuhlmann', email: 'peter@agentur.de', role: 'Admin', twoFactor: true },
  { id: 'u2', name: 'Anna Schmidt', email: 'anna@agentur.de', role: 'Mitglied', twoFactor: false },
];
const invitations = [
  { id: 'i1', email: 'ben@agentur.de', role: 'Mitglied', expires: '12.11. 14:30' },
];

describe('TeamList', () => {
  it('lists the accounts with role and 2FA state', () => {
    render(<TeamList members={members} invitations={[]} />);
    const team = within(screen.getByRole('region', { name: 'Team' }));
    expect(team.getAllByRole('listitem')).toHaveLength(2);
    expect(team.getByText('2FA aktiv')).toBeVisible();
    expect(team.getByText('2FA fehlt')).toBeVisible();
    expect(screen.getByText('Keine offenen Einladungen.')).toBeVisible();
  });

  it('lets admins revoke an open invitation', () => {
    const revoke = vi.fn();
    render(<TeamList members={members} invitations={invitations} revokeAction={revoke} />);
    const open = within(screen.getByRole('region', { name: 'Offene Einladungen' }));
    expect(open.getByText('Mitglied · gültig bis 12.11. 14:30')).toBeVisible();
    const button = open.getByRole('button', { name: 'Einladung für ben@agentur.de zurückziehen' });
    expect(button.closest('form')?.querySelector('input[name="id"]')).toHaveValue('i1');
  });

  it('only shows the invitations to members', () => {
    render(<TeamList members={members} invitations={invitations} />);
    expect(screen.queryByRole('button', { name: /zurückziehen/ })).not.toBeInTheDocument();
  });
});
