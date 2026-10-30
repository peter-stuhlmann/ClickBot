import 'server-only';
import type { OpenInvitation, TeamMember } from '@click-bot/db';
import { avatarUrl } from '@/lib/avatar';
import { formatShortDateTime } from '@/lib/format';
import type { InvitationView, TeamMemberView } from '@/lib/views';

const ROLE_LABEL = { admin: 'Admin', member: 'Mitglied' } as const;

export function toTeamMember(member: TeamMember): TeamMemberView {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: ROLE_LABEL[member.role],
    twoFactor: member.hasTotp,
    avatarSrc: avatarUrl(member.id, member.avatarUpdatedAt),
  };
}

export function toInvitation(invitation: OpenInvitation): InvitationView {
  return {
    id: invitation.id,
    email: invitation.email,
    role: ROLE_LABEL[invitation.role],
    expires: formatShortDateTime(invitation.expiresAt),
  };
}
