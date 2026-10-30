import Link from 'next/link';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type UserCardProps = {
  name: string;
  role: string;
  avatarSrc?: string | null;
  /** True on the profile page. */
  current?: boolean;
};

/** The signed-in user at the bottom of the sidebar: leads to the profile; logout is a POST form. */
export function UserCard({ name, role, avatarSrc, current = false }: UserCardProps) {
  return (
    <div className="flex items-center gap-1 pt-3">
      <Link
        href="/profil"
        aria-label={`Profil: ${name}`}
        aria-current={current ? 'page' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-input py-1.5 pl-2 transition-colors',
          'hover:bg-sidebar-active focus-visible:outline-2 focus-visible:outline-primary',
          current && 'bg-sidebar-active',
        )}
      >
        <Avatar name={name} src={avatarSrc} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-meta font-medium text-on-primary">{name}</span>
          <span className="text-small text-sidebar-muted">{role}</span>
        </span>
      </Link>
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
