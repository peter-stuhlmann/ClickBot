'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import {
  addDays,
  addMonths,
  describeDay,
  endOfWeek,
  formatGermanDate,
  isIsoDate,
  monthGrid,
  monthLabel,
  parseGermanDate,
  startOfWeek,
  todayIn,
} from '@/lib/calendar';
import { cn } from '@/lib/cn';

export type DatePickerProps = {
  /** What the date is, e.g. "Startdatum": names the calendar button and the calendar. */
  label: string;
  /** Id of the text field, e.g. from Field. */
  id?: string;
  /** For plain forms: a hidden field of this name carries the date as "2026-11-20". */
  name?: string;
  /** Controlled: "2026-11-20", '' or a typo as typed. */
  value?: string;
  /** Uncontrolled start value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
};

const WEEKDAYS = [
  ['Mo', 'Montag'],
  ['Di', 'Dienstag'],
  ['Mi', 'Mittwoch'],
  ['Do', 'Donnerstag'],
  ['Fr', 'Freitag'],
  ['Sa', 'Samstag'],
  ['So', 'Sonntag'],
] as const;

// w-72 of the calendar, to open it to the left where the window ends on the right.
const CALENDAR_WIDTH = 288;

const iconButton =
  'rounded-input p-1.5 text-text-muted transition-colors hover:bg-neutral-soft hover:text-text focus-visible:outline-2 focus-visible:outline-primary';

/**
 * A date field: type it as "20.11.2026" (also "20.11.26" or "2026-11-20") or choose it in a
 * calendar, which works with the keyboard like the date picker of the WAI-ARIA patterns. Passes
 * the date on as "2026-11-20"; a typo passes on as typed, so the form can say what is wrong.
 */
export function DatePicker({
  label,
  id,
  name,
  value,
  defaultValue = '',
  onChange,
  required = false,
  disabled = false,
  className,
  ...aria
}: DatePickerProps) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  // What is being typed; null shows the date in its German form.
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(current);
  const [alignEnd, setAlignEnd] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const days = useRef<HTMLTableSectionElement>(null);
  // Set when the focus should follow the focused day (opening, keyboard), not on month buttons.
  const moveFocus = useRef(false);
  const dialogId = useId();
  const headingId = useId();
  const today = todayIn(new Date());

  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    days.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  function commit(next: string) {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  }

  function type(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value;
    setText(typed);
    commit(typed.trim() === '' ? '' : (parseGermanDate(typed) ?? typed.trim()));
  }

  function show() {
    const box = root.current?.getBoundingClientRect();
    setAlignEnd(Boolean(box && box.left + CALENDAR_WIDTH > window.innerWidth - 16));
    setFocused(isIsoDate(current) ? current : today);
    moveFocus.current = true;
    setOpen(true);
  }

  function close() {
    setOpen(false);
    toggle.current?.focus();
  }

  function choose(day: string) {
    commit(day);
    setText(null);
    setOpen(false);
    field.current?.focus();
  }

  function onFieldKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      show();
    }
  }

  function onDayKey(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const years = event.shiftKey ? 12 : 1;
    const moves: Record<string, string> = {
      ArrowLeft: addDays(day, -1),
      ArrowRight: addDays(day, 1),
      ArrowUp: addDays(day, -7),
      ArrowDown: addDays(day, 7),
      Home: startOfWeek(day),
      End: endOfWeek(day),
      PageUp: addMonths(day, -years),
      PageDown: addMonths(day, years),
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    moveFocus.current = true;
    setFocused(next);
  }

  return (
    <div
      ref={root}
      className={cn('relative', className)}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
      onBlur={(event) => {
        // Tabbing out of field and calendar closes the calendar.
        const next = event.relatedTarget as Node | null;
        if (open && next && !root.current?.contains(next)) setOpen(false);
      }}
    >
      <Input
        ref={field}
        id={id}
        value={text ?? formatGermanDate(current)}
        onChange={type}
        onBlur={() => setText(null)}
        onKeyDown={onFieldKey}
        placeholder="TT.MM.JJJJ"
        autoComplete="off"
        required={required}
        disabled={disabled}
        className="pr-10"
        {...aria}
      />
      <button
        ref={toggle}
        type="button"
        aria-label={`Kalender für ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        className={cn(
          iconButton,
          'absolute top-1/2 right-1.5 -translate-y-1/2 disabled:opacity-60',
        )}
      >
        <Icon name="calendar" size={16} />
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`${label} wählen`}
          className={cn(
            'absolute top-full z-50 mt-1 w-72 rounded-card border border-border bg-surface p-3 shadow-dialog',
            alignEnd ? 'right-0' : 'left-0',
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Vorheriger Monat"
              onClick={() => setFocused(addMonths(focused, -1))}
              className={iconButton}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <h2 id={headingId} aria-live="polite" className="text-body font-semibold text-text">
              {monthLabel(focused)}
            </h2>
            <button
              type="button"
              aria-label="Nächster Monat"
              onClick={() => setFocused(addMonths(focused, 1))}
              className={iconButton}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>

          <table role="grid" aria-labelledby={headingId} className="w-full border-collapse">
            <thead>
              <tr>
                {WEEKDAYS.map(([short, long]) => (
                  <th
                    key={short}
                    scope="col"
                    abbr={long}
                    className="pb-1 text-label font-medium text-text-muted"
                  >
                    {short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={days}>
              {monthGrid(focused).map((week) => (
                <tr key={week[0]}>
                  {week.map((day) => {
                    const selected = day === current;
                    const inMonth = day.slice(0, 7) === focused.slice(0, 7);
                    return (
                      <td key={day} aria-selected={selected} className="p-0 text-center">
                        <button
                          type="button"
                          data-day={day}
                          tabIndex={day === focused ? 0 : -1}
                          aria-label={describeDay(day)}
                          aria-current={day === today ? 'date' : undefined}
                          onClick={() => choose(day)}
                          onKeyDown={(event) => onDayKey(event, day)}
                          className={cn(
                            'size-9 rounded-input text-body transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                            selected
                              ? 'bg-primary font-semibold text-on-primary'
                              : 'hover:bg-neutral-soft',
                            !selected && (inMonth ? 'text-text' : 'text-text-subtle'),
                            !selected && day === today && 'font-semibold text-primary',
                          )}
                        >
                          {Number(day.slice(8))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <Button variant="ghost" size="sm" onClick={() => choose(today)}>
              Heute
            </Button>
            {!required && current && (
              <Button variant="ghost" size="sm" onClick={() => choose('')}>
                Entfernen
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
