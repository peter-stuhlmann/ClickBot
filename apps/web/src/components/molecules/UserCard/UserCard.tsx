import { Avatar } from '@/components/atoms/Avatar';

export type UserCardProps = {
  name: string;
  role: string;
};

export function UserCard({ name, role }: UserCardProps) {
  return (
    <div className="flex items-center gap-2.5 pt-3 pl-2">
      <Avatar name={name} />
      <div className="flex flex-col">
        <span className="text-meta font-medium text-on-primary">{name}</span>
        <span className="text-small text-sidebar-muted">{role}</span>
      </div>
    </div>
  );
}
