import {
  Bot,
  CalendarDays,
  Copy,
  History,
  Plus,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// The icons used in the Figma design (lucide set). Add new ones here, not ad hoc in components.
const ICONS = {
  bot: Bot,
  calendar: CalendarDays,
  copy: Copy,
  history: History,
  plus: Plus,
  sliders: SlidersHorizontal,
  users: Users,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  /** Pixel size; the design uses 18 in navigation and 16 in buttons. */
  size?: 16 | 18;
  className?: string;
};

/** Decorative icon. The surrounding element carries the accessible name. */
export function Icon({ name, size = 18, className }: IconProps) {
  const Component = ICONS[name];
  return (
    <Component
      aria-hidden="true"
      data-icon={name}
      width={size}
      height={size}
      strokeWidth={1.5}
      className={cn('shrink-0', className)}
    />
  );
}
