import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDot,
  Clock,
  Code,
  Copy,
  ExternalLink,
  Folder,
  Globe,
  History,
  List,
  LogOut,
  Maximize2,
  Menu,
  MapPin,
  Megaphone,
  Minus,
  Monitor,
  Play,
  Plus,
  RotateCw,
  Search,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// The icons used in the Figma design (lucide set). Add new ones here, not ad hoc in components.
const ICONS = {
  alert: TriangleAlert,
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUp: ArrowUp,
  bot: Bot,
  calendar: CalendarDays,
  camera: Camera,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevrons: ChevronsUpDown,
  clock: Clock,
  close: X,
  code: Code,
  copy: Copy,
  external: ExternalLink,
  expand: Maximize2,
  folder: Folder,
  globe: Globe,
  desktop: Monitor,
  history: History,
  list: List,
  location: MapPin,
  megaphone: Megaphone,
  logout: LogOut,
  menu: Menu,
  minus: Minus,
  phone: Smartphone,
  play: Play,
  plus: Plus,
  reload: RotateCw,
  search: Search,
  settings: Settings,
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
  /** Pixel size; the design uses 18 in navigation, 16 in buttons and 12 in chips. */
  size?: 12 | 16 | 18;
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
