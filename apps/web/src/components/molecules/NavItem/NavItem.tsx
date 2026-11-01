'use client';

import Link, { useLinkStatus } from 'next/link';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type NavItemProps = {
  href: string;
  label: string;
  icon: IconName;
  active?: boolean;
};

/** A small spinner at the end of the item while its page loads, so the click shows at once. */
function PendingMark() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="ml-auto size-3.5 animate-spin rounded-full border-2 border-sidebar-muted border-t-transparent"
    />
  );
}

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
      <PendingMark />
    </Link>
  );
}
