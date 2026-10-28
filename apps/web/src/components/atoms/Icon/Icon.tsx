import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  CalendarDays,
  Check,
  CircleDot,
  Code,
  Copy,
  History,
  List,
  MapPin,
  Minus,
  Monitor,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// The icons used in the Figma design (lucide set). Add new ones here, not ad hoc in components.
const ICONS = {
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUp: ArrowUp,
  bot: Bot,
  calendar: CalendarDays,
  check: Check,
  close: X,
  code: Code,
  copy: Copy,
  desktop: Monitor,
  history: History,
  list: List,
  location: MapPin,
  minus: Minus,
  phone: Smartphone,
  plus: Plus,
  record: CircleDot,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  tablet: Tablet,
  trash: Trash2,
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
