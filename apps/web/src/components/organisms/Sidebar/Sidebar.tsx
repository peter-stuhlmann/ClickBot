'use client';

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '@/components/atoms/Icon';
import { LogoMark } from '@/components/atoms/LogoMark';
import { NavItem, type NavItemProps } from '@/components/molecules/NavItem';
import { ProjectSwitcher, type ProjectOption } from '@/components/molecules/ProjectSwitcher';
import { UserCard, type UserCardProps } from '@/components/molecules/UserCard';
import { WorkerStatus, type WorkerStatusProps } from '@/components/molecules/WorkerStatus';
import { cn } from '@/lib/cn';

export const NAVIGATION = [
  { key: 'kampagnen', href: '/kampagnen', label: 'Kampagnen', icon: 'megaphone' },
  { key: 'jobs', href: '/', label: 'Jobs', icon: 'bot' },
  { key: 'kalender', href: '/kalender', label: 'Kalender', icon: 'calendar' },
  { key: 'laeufe', href: '/laeufe', label: 'Läufe', icon: 'history' },
  { key: 'vorlagen', href: '/vorlagen', label: 'Vorlagen', icon: 'copy' },
  { key: 'einstellungen', href: '/einstellungen', label: 'Einstellungen', icon: 'sliders' },
] as const satisfies (Omit<NavItemProps, 'active'> & { key: string })[];

export type NavKey = (typeof NAVIGATION)[number]['key'];

export type SidebarProps = {
  /** The section of the page; 'profil' marks the user card at the bottom instead. */
  active: NavKey | 'profil';
  worker: WorkerStatusProps;
  /** Null until someone is signed in. */
  user: UserCardProps | null;
  /** The projects for the switcher above the navigation; the pages show `project`. */
  projects: ProjectOption[];
  project: ProjectOption | null;
  selectProject: (projectId: string) => void;
};

const iconButton =
  'rounded-input p-2 text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-on-primary focus-visible:outline-2 focus-visible:outline-primary';

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-h2 font-semibold text-on-primary">Click-Bot</span>
    </div>
  );
}

/**
 * From `lg` on a column beside the page, sticky at window height, so the user card stays at the
 * bottom however long the page is. Below that a top bar whose menu button opens the same column
 * as a drawer.
 */
export function Sidebar({ active, worker, user, projects, project, selectProject }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // A chosen section navigates on the client, so the drawer has to close itself.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar py-2 pr-2 pl-4 lg:hidden">
        <Brand />
        <button
          ref={menuButton}
          type="button"
          aria-label="Menü öffnen"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
          className={iconButton}
        >
          <Icon name="menu" size={18} />
        </button>
      </header>

      {open && (
        <div
          data-testid="menu-backdrop"
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
        />
      )}

      <aside
        id={drawerId}
        onClick={closeOnLink}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-1 overflow-y-auto bg-sidebar px-3 pt-5 pb-4 transition-transform',
          open ? 'translate-x-0' : 'invisible -translate-x-full',
          'lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-60 lg:shrink-0 lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between pb-5 pl-2">
          <Brand />
          <button
            ref={closeButton}
            type="button"
            aria-label="Menü schließen"
            onClick={() => setOpen(false)}
            className={cn(iconButton, 'lg:hidden')}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="pb-4">
          <ProjectSwitcher
            projects={projects}
            current={project}
            onSelect={selectProject}
            newProjectHref="/projekte/neu"
          />
        </div>

        <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
          {NAVIGATION.map(({ key, ...item }) => (
            <NavItem key={key} {...item} active={key === active} />
          ))}
        </nav>

        <div className="flex-1" />
        <WorkerStatus {...worker} />
        {user && <UserCard {...user} current={active === 'profil'} />}
      </aside>
    </>
  );
}
