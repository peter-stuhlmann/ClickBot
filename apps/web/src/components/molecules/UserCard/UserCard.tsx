import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';

export type UserCardProps = {
  name: string;
  role: string;
};

/** The signed-in user at the bottom of the sidebar, with logout (a plain POST form). */
export function UserCard({ name, role }: UserCardProps) {
  return (
    <div className="flex items-center gap-2.5 pt-3 pl-2">
      <Avatar name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-meta font-medium text-on-primary">{name}</span>
        <span className="text-small text-sidebar-muted">{role}</span>
      </div>
      <form method="post" action="/abmelden">
        <button
          type="submit"
          aria-label="Abmelden"
          title="Abmelden"
          className="rounded-input p-2 text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-on-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="logout" size={16} />
        </button>
      </form>
    </div>
  );
}
