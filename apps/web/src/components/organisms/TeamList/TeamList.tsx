import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import type { InvitationView, TeamMemberView } from '@/lib/views';

export type TeamListProps = {
  members: TeamMemberView[];
  invitations: InvitationView[];
  /** Server action; receives the invitation `id`. Omitted for members, who only look. */
  revokeAction?: (formData: FormData) => void | Promise<void>;
};

/** The accounts of the team and the invitation links that are still open. */
export function TeamList({ members, invitations, revokeAction }: TeamListProps) {
  return (
    <>
      <Card title="Team">
        <ul className="flex flex-col divide-y divide-divider">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} src={member.avatarSrc} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-medium text-text">{member.name}</span>
                  <span className="truncate text-small text-text-muted">{member.email}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-meta text-text-muted">{member.role}</span>
                <Badge tone={member.twoFactor ? 'success' : 'warning'}>
                  {member.twoFactor ? '2FA aktiv' : '2FA fehlt'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Offene Einladungen">
        {invitations.length === 0 ? (
          <p className="text-body text-text-muted">Keine offenen Einladungen.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body text-text">{invitation.email}</span>
                  <span className="text-small text-text-muted">
                    {invitation.role} · gültig bis {invitation.expires}
                  </span>
                </div>
                {revokeAction && (
                  <form action={revokeAction}>
                    <input type="hidden" name="id" value={invitation.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      aria-label={`Einladung für ${invitation.email} zurückziehen`}
                    >
                      Zurückziehen
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
