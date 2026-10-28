import Link from 'next/link';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type NavItemProps = {
  href: string;
  label: string;
  icon: IconName;
  active?: boolean;
};

export function NavItem({ href, label, icon, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-input px-3 py-2 text-body font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-primary',
        active
          ? 'bg-sidebar-active text-on-primary'
          : 'text-sidebar-text hover:bg-sidebar-active hover:text-on-primary',
      )}
    >
      <Icon name={icon} className={active ? 'text-on-primary' : 'text-sidebar-muted'} />
      {label}
    </Link>
  );
}
