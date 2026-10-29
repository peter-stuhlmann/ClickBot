import type { ReactNode } from 'react';
import { ActionBar } from '@/components/atoms/ActionBar';

export type EditorLayoutProps = {
  /** PageHeader with breadcrumb and status. */
  header: ReactNode;
  /** Save and test-run buttons: beside the header, on small screens at the bottom of the window. */
  actions: ReactNode;
  /** Shown above both columns, e.g. "Gespeichert" or an error summary. */
  message?: ReactNode;
  /** Job settings, schedule and devices. */
  settings: ReactNode;
  /** The flow: step list and step form. */
  children: ReactNode;
};

/**
 * Editor (screen 02): settings on the left, the flow on the right; below `xl` one above the other.
 */
export function EditorLayout({ header, actions, message, settings, children }: EditorLayoutProps) {
  return (
    // From `xl` a wrapping row: header and buttons, then the content on a line of its own.
    <div className="flex flex-col gap-6 xl:flex-row xl:flex-wrap xl:items-center">
      <div className="min-w-0 xl:flex-1">{header}</div>
      <ActionBar>{actions}</ActionBar>
      {message && <div className="xl:basis-full">{message}</div>}
      <div className="flex min-w-0 flex-col gap-6 xl:basis-full xl:flex-row xl:items-start">
        <section aria-label="Einstellungen" className="flex flex-col gap-6 xl:w-110 xl:shrink-0">
          {settings}
        </section>
        <section aria-label="Ablauf bearbeiten" className="flex min-w-0 flex-1 flex-col gap-6">
          {children}
        </section>
      </div>
    </div>
  );
}
