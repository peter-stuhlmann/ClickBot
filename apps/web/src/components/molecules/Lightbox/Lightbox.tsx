'use client';

import { useEffect, useEffectEvent, useId, useRef, type ReactNode, type Ref } from 'react';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type LightboxImage = {
  url: string;
  /** Text alternative of the picture. */
  alt: string;
  /** Above the picture and the name of the dialog, e.g. "Schritt 13 · Klicke auf „Ablehnen“". */
  caption: string;
};

export type LightboxProps = {
  images: LightboxImage[];
  /** The picture shown; null while the lightbox is closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

// A swipe pages when it moves at least this far, and more sideways than up or down.
const SWIPE_PX = 50;

function RoundButton({
  label,
  disabled,
  onClick,
  className,
  children,
  ref,
}: {
  ref?: Ref<HTMLButtonElement>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-surface transition-colors hover:bg-sidebar focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Pictures over the whole window, one at a time: arrows, arrow keys and a swipe page, Escape,
 * "Schließen" and a click beside the picture close. A modal <dialog> keeps the focus inside and
 * makes the page behind it inert.
 */
export function Lightbox({ images, index, onIndexChange, onClose }: LightboxProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const captionId = useId();
  const image = index === null ? undefined : images[index];
  const open = image !== undefined;
  const count = images.length;

  // Opened once the content is rendered; the focus goes to "Schließen", not to the link.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeButton.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const page = (step: -1 | 1) => {
    if (index === null) return;
    const next = index + step;
    if (next >= 0 && next < count) onIndexChange(next);
  };

  // On the window, not the dialog: at either end the arrow button is disabled and loses the
  // focus, and the keys would no longer reach the dialog.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') page(-1);
    if (event.key === 'ArrowRight') page(1);
  });
  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={captionId}
      onClose={onClose}
      // The browser keeps a <dialog> inside the window; these undo its size limits and margin.
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-sidebar-text backdrop:bg-sidebar/95"
    >
      {image && index !== null && (
        <div className="flex size-full flex-col">
          <div className="flex items-center gap-3 px-4 py-3">
            {count > 1 && (
              <span className="shrink-0 text-small text-sidebar-text tabular-nums">
                {index + 1} / {count}
              </span>
            )}
            <h2
              id={captionId}
              className="min-w-0 flex-1 truncate text-body font-medium text-surface"
            >
              {image.caption}
            </h2>
            <a
              href={image.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Original in neuem Tab öffnen"
              className="flex shrink-0 items-center gap-1.5 rounded-input px-2 py-1.5 text-meta font-medium text-sidebar-text hover:bg-sidebar-active hover:text-surface focus-visible:outline-2 focus-visible:outline-surface"
            >
              <Icon name="external" size={16} />
              <span className="hidden sm:inline">Original</span>
            </a>
            <RoundButton ref={closeButton} label="Schließen" onClick={() => ref.current?.close()}>
              <Icon name="close" size={18} />
            </RoundButton>
          </div>
          {/* Beside the picture is the backdrop: a click there closes, like on the backdrop. */}
          <div
            data-testid="lightbox-stage"
            onClick={(event) => {
              if (event.target === event.currentTarget) ref.current?.close();
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              const touch = event.changedTouches[0];
              touchStart.current = null;
              if (!start || !touch) return;
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
              page(dx < 0 ? 1 : -1);
            }}
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16"
          >
            {/* Screenshots are local files of any size; next/image would need fixed dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.alt}
              draggable={false}
              className="max-h-full max-w-full rounded-input bg-surface object-contain select-none"
            />
            {count > 1 && (
              <>
                <RoundButton
                  label="Vorheriges Bild"
                  disabled={index === 0}
                  onClick={() => page(-1)}
                  className="absolute top-1/2 left-2 -translate-y-1/2 sm:left-3"
                >
                  <Icon name="chevronLeft" size={18} />
                </RoundButton>
                <RoundButton
                  label="Nächstes Bild"
                  disabled={index === count - 1}
                  onClick={() => page(1)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 sm:right-3"
                >
                  <Icon name="chevronRight" size={18} />
                </RoundButton>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
