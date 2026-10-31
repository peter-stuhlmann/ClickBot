'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { cn } from '@/lib/cn';

export type WaitUntil =
  { kind: 'duration'; ms: number } | { kind: 'networkIdle' } | { kind: 'text'; text: string };

export type WaitMenuProps = {
  /** The next click in the live view chooses the element to wait for. */
  picking: boolean;
  onInsert: (until: WaitUntil) => void;
  onPickElement: () => void;
};

const TIME_RANGE = 'Zwischen 0,1 und 60 Sekunden.';

/** "2,5" → 2500; null for anything that is no time between 0,1 and 60 seconds. */
function toMs(seconds: string): number | null {
  const value = Number(seconds.trim().replace(',', '.'));
  if (!seconds.trim() || !Number.isFinite(value) || value < 0.1 || value > 60) return null;
  return Math.round(value * 1000);
}

/**
 * Inserts waiting into a recording: a fixed time, until the page loads nothing more, until a
 * text shows, or until an element shows, which the next click in the live view chooses.
 */
export function WaitMenu({ picking, onInsert, onPickElement }: WaitMenuProps) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState('2');
  const [text, setText] = useState('');
  const [timeError, setTimeError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const timeHint = useId();

  const close = (focusOpener = false) => {
    setOpen(false);
    setTimeError(false);
    if (focusOpener) opener.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const insert = (until: WaitUntil) => {
    onInsert(until);
    close(true);
  };

  function waitSeconds(event: FormEvent) {
    event.preventDefault();
    const ms = toMs(seconds);
    if (ms === null) return setTimeError(true);
    insert({ kind: 'duration', ms });
  }

  function waitForText(event: FormEvent) {
    event.preventDefault();
    if (text.trim()) insert({ kind: 'text', text: text.trim() });
  }

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <Button
        ref={opener}
        variant={picking ? 'secondary' : 'ghost'}
        size="sm"
        aria-label="Warten einfügen"
        title="Warten einfügen"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(picking && 'border-primary text-primary')}
        icon={<Icon name="clock" size={16} />}
        onClick={() => (open ? close() : setOpen(true))}
      />
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Warten"
          className="absolute right-0 z-20 mt-1 flex w-72 flex-col gap-3 rounded-card border border-border bg-surface p-3 shadow-dialog"
        >
          <form className="flex flex-col gap-1" onSubmit={waitSeconds}>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Sekunden"
                inputMode="decimal"
                className="w-20"
                value={seconds}
                aria-invalid={timeError || undefined}
                aria-describedby={timeError ? timeHint : undefined}
                onChange={(event) => {
                  setSeconds(event.target.value);
                  setTimeError(false);
                }}
              />
              <Button type="submit" variant="secondary" size="sm">
                Sekunden warten
              </Button>
            </div>
            {timeError && (
              <p id={timeHint} className="text-small text-danger">
                {TIME_RANGE}
              </p>
            )}
          </form>
          <Button variant="secondary" size="sm" onClick={() => insert({ kind: 'networkIdle' })}>
            Bis die Seite nichts mehr lädt
          </Button>
          <form className="flex items-center gap-2" onSubmit={waitForText}>
            <Input
              aria-label="Text"
              placeholder="z. B. Vielen Dank"
              className="min-w-0 flex-1"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" variant="secondary" size="sm">
              Bis der Text erscheint
            </Button>
          </form>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onPickElement();
              close();
            }}
          >
            Bis ein Element erscheint …
          </Button>
          <p className="text-small text-text-muted">
            Danach das Element im Bild anklicken; die Seite reagiert nicht auf diesen Klick.
          </p>
        </div>
      )}
    </div>
  );
}
