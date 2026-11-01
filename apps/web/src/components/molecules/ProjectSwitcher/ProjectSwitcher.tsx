'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { cn } from '@/lib/cn';

export type ProjectOption = { id: string; name: string };

export type ProjectSwitcherProps = {
  projects: ProjectOption[];
  /** Null while there is no project yet. */
  current: ProjectOption | null;
  onSelect: (projectId: string) => void;
  newProjectHref: string;
  /** True while the chosen project is being applied; the trigger shows it and waits. */
  busy?: boolean;
};

/**
 * The project everything below it in the sidebar shows. Opens a panel with a search field that
 * filters while typing, the projects, and "Neues Projekt" fixed at the bottom.
 */
export function ProjectSwitcher({
  projects,
  current,
  onSelect,
  newProjectHref,
  busy = false,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const needle = query.trim().toLocaleLowerCase('de');
  const matches = projects.filter((project) =>
    project.name.toLocaleLowerCase('de').includes(needle),
  );

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  function toggle() {
    setQuery('');
    setActive(0);
    setOpen((was) => !was);
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function choose(project: ProjectOption) {
    setOpen(false);
    onSelect(project.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const project = matches[active];
      if (project) choose(project);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`Projekt: ${current?.name ?? 'keins'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-input bg-sidebar-active px-3 py-2 text-left transition-colors hover:bg-sidebar-active/80 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-70"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-label font-semibold text-sidebar-muted uppercase">Projekt</span>
          <span className="truncate text-body font-medium text-on-primary">
            {current?.name ?? 'Noch kein Projekt'}
          </span>
        </span>
        {busy ? (
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-sidebar-muted border-t-transparent"
          />
        ) : (
          <Icon name="chevrons" size={16} className="shrink-0 text-sidebar-muted" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Projekt wechseln"
          className="absolute inset-x-0 top-full z-50 mt-1 flex max-h-96 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-dialog"
        >
          <div className="relative border-b border-border p-2">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-text-muted"
            />
            <Input
              type="search"
              aria-label="Projekt suchen"
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
              placeholder="Suchen …"
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="py-2 pl-9"
            />
          </div>

          {matches.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Projekte"
              className="flex-1 overflow-y-auto p-1"
            >
              {matches.map((project, index) => {
                const selected = project.id === current?.id;
                return (
                  <li
                    key={project.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(project)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-input px-3 py-2 text-body text-text',
                      index === active && 'bg-neutral-soft',
                    )}
                  >
                    <span className="truncate">{project.name}</span>
                    {selected && <Icon name="check" size={16} className="shrink-0 text-primary" />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex-1 px-4 py-3 text-body text-text-muted">Kein Projekt gefunden.</p>
          )}

          {/* Stays at the bottom while the list scrolls. */}
          <div className="border-t border-border p-1">
            <Link
              href={newProjectHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-input px-3 py-2 text-body font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon name="plus" size={16} />
              Neues Projekt
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
