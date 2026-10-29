import { LogoMark } from '@/components/atoms/LogoMark';
import { NavItem, type NavItemProps } from '@/components/molecules/NavItem';
import { UserCard, type UserCardProps } from '@/components/molecules/UserCard';
import { WorkerStatus, type WorkerStatusProps } from '@/components/molecules/WorkerStatus';

export const NAVIGATION = [
  { key: 'kunden', href: '/kunden', label: 'Kunden', icon: 'users' },
  { key: 'jobs', href: '/', label: 'Jobs', icon: 'bot' },
  { key: 'kalender', href: '/kalender', label: 'Kalender', icon: 'calendar' },
  { key: 'laeufe', href: '/laeufe', label: 'Läufe', icon: 'history' },
  { key: 'vorlagen', href: '/vorlagen', label: 'Vorlagen', icon: 'copy' },
  { key: 'einstellungen', href: '/einstellungen', label: 'Einstellungen', icon: 'sliders' },
] as const satisfies (Omit<NavItemProps, 'active'> & { key: string })[];

export type NavKey = (typeof NAVIGATION)[number]['key'];

export type SidebarProps = {
  active: NavKey;
  worker: WorkerStatusProps;
  /** Null until someone is signed in. */
  user: UserCardProps | null;
};

export function Sidebar({ active, worker, user }: SidebarProps) {
  return (
    // Sticky at window height: the user card stays at the bottom however long the page is.
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto bg-sidebar px-3 pt-5 pb-4">
      <div className="flex items-center gap-2.5 pb-5 pl-2">
        <LogoMark />
        <span className="text-h2 font-semibold text-on-primary">Click-Bot</span>
      </div>

      <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
        {NAVIGATION.map(({ key, ...item }) => (
          <NavItem key={key} {...item} active={key === active} />
        ))}
      </nav>

      <div className="flex-1" />
      <WorkerStatus {...worker} />
      {user && <UserCard {...user} />}
    </aside>
  );
}
