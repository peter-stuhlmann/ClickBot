'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type SelectOption<T extends string = string> = { value: T; label: string };

export type SelectProps<T extends string = string> = {
  options: readonly SelectOption<T>[];
  /** First, empty entry, e.g. "Kampagne wählen". */
  placeholder?: string;
  /** Id of the box, e.g. from Field; the label with the id "<id>-label" also names the list. */
  id?: string;
  /** For plain forms: a hidden field of this name carries the value. */
  name?: string;
  /** Controlled value. */
  value?: T | '';
  /** Uncontrolled start value; without one the first entry, like a native select. */
  defaultValue?: T | '';
  onChange?: (value: T) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
};

// Room the list needs below the box (max-h-68); with less the list opens upwards.
const LIST_HEIGHT = 272;
// Widest list (max-w-72); it grows to its entries, but opens to the left where the window ends.
const LIST_WIDTH = 288;
const TYPE_AHEAD_MS = 600;

/**
 * A dropdown like a native select, but styled: the list marks the chosen entry with a check. Works
 * like the "select-only combobox" of the WAI-ARIA patterns: arrows, Home/End, Enter, Escape and
 * typing the first letters of an entry. The focus stays on the box.
 */
export function Select<T extends string = string>({
  options,
  placeholder,
  id,
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  className,
  ...aria
}: SelectProps<T>) {
  const entries: readonly SelectOption<T | ''>[] =
    placeholder === undefined ? options : [{ value: '', label: placeholder }, ...options];
  const [own, setOwn] = useState<T | ''>(defaultValue ?? entries[0]?.value ?? '');
  const current = value ?? own;
  const chosen = Math.max(
    entries.findIndex((entry) => entry.value === current),
    0,
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(chosen);
  const [upwards, setUpwards] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  });

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  function show(at = chosen) {
    const rect = box.current?.getBoundingClientRect();
    setUpwards(
      Boolean(rect && window.innerHeight - rect.bottom < LIST_HEIGHT && rect.top > LIST_HEIGHT),
    );
    setAlignEnd(Boolean(rect && rect.left + LIST_WIDTH > window.innerWidth - 16));
    setActive(at);
    setOpen(true);
  }

  function choose(index: number) {
    const entry = entries[index];
    setOpen(false);
    box.current?.focus();
    if (!entry || entry.value === current) return;
    if (value === undefined) setOwn(entry.value);
    // The placeholder entry stands for "nothing chosen"; callers get it as ''.
    onChange?.(entry.value as T);
  }

  /** The next entry starting with what was typed, from the active one on. */
  function findTyped(key: string): number | null {
    const now = Date.now();
    const text = now - typed.current.at < TYPE_AHEAD_MS ? typed.current.text + key : key;
    typed.current = { text, at: now };
    const needle = text.toLocaleLowerCase('de');
    const start = open && text.length === 1 ? active + 1 : open ? active : chosen;
    for (let step = 0; step < entries.length; step += 1) {
      const index = (start + step) % entries.length;
      if (entries[index]?.label.toLocaleLowerCase('de').startsWith(needle)) return index;
    }
    return null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const last = entries.length - 1;
    if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey) {
      const found = findTyped(event.key);
      if (found !== null) {
        if (open) setActive(found);
        else show(found);
      }
      return;
    }
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        show(event.key === 'Home' ? 0 : last);
      }
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
      PageDown: Math.min(active + 10, last),
      PageUp: Math.max(active - 10, 0),
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  const label = entries[chosen]?.label ?? '';
  const empty = placeholder !== undefined && current === '';

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={box}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-input border border-border-strong bg-surface px-3 py-2.5 text-left text-body text-text',
          'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft aria-expanded:border-primary',
          'disabled:bg-neutral-soft aria-invalid:border-danger',
        )}
        {...aria}
      >
        <span className={cn('truncate', empty && 'text-text-subtle')}>{label}</span>
        <Icon
          name="chevronDown"
          size={16}
          className={cn(
            'shrink-0 text-text-muted transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={id ? `${id}-label` : undefined}
          aria-label={id ? undefined : aria['aria-label']}
          className={cn(
            'absolute z-50 max-h-68 w-max max-w-72 min-w-full overflow-y-auto overscroll-contain rounded-card border border-border bg-surface p-1 shadow-dialog',
            upwards ? 'bottom-full mb-1' : 'top-full mt-1',
            alignEnd ? 'right-0' : 'left-0',
          )}
        >
          {entries.map((entry, index) => {
            const selected = index === chosen;
            return (
              <li
                key={entry.value}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                // Keeps the focus on the box, where the keyboard works.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-input px-3 py-2 text-body',
                  index === active && 'bg-neutral-soft',
                  selected ? 'font-medium text-primary' : 'text-text',
                  entry.value === '' && !selected && 'text-text-muted',
                )}
              >
                <span className="truncate">{entry.label}</span>
                {selected && <Icon name="check" size={16} className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
