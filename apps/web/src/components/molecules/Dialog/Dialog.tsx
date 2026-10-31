'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/atoms/Button';
import { Icon, type IconName } from '@/components/atoms/Icon';

type DialogControl = { close: () => void };

const DialogContext = createContext<DialogControl | null>(null);

/** Inside a dialog: closes it, e.g. for "Abbrechen" of a form. Null outside of one. */
export function useDialog(): DialogControl | null {
  return useContext(DialogContext);
}

const FOCUSABLE =
  'input:not([type="hidden"]), textarea, button:not(:disabled), select, a[href], [tabindex="0"]';

export type DialogProps = {
  /** Accessible name of the icon button that opens the dialog. */
  label: string;
  title: string;
  icon?: IconName;
  children: ReactNode;
};

/**
 * An icon button that opens a modal dialog. The browser's <dialog> keeps the focus inside,
 * closes on Escape and makes the page behind it inert. The content is only rendered while the
 * dialog is open, so closing it drops what was typed.
 */
export function Dialog({ label, title, icon = 'settings', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => ref.current?.close();

  // Opened once the content is rendered; the focus goes to its first field, not to "Schließen".
  useEffect(() => {
    if (!open) return;
    ref.current?.showModal();
    content.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        aria-haspopup="dialog"
        icon={<Icon name={icon} size={18} />}
        onClick={() => setOpen(true)}
      />
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the <dialog> itself; the content covers the rest.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        // The browser keeps a <dialog> inside the window; m-auto undoes the reset of its margin.
        className="m-auto rounded-card bg-bg text-text shadow-dialog backdrop:bg-overlay"
      >
        {open && (
          <div className="flex w-xl max-w-full flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-card font-semibold text-text">
                {title}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Schließen"
                icon={<Icon name="close" size={18} />}
                onClick={close}
              />
            </div>
            <div ref={content} className="flex flex-col gap-4">
              <DialogContext value={{ close }}>{children}</DialogContext>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
