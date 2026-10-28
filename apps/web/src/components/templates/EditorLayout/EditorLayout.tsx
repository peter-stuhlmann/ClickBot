import type { ReactNode } from 'react';

export type EditorLayoutProps = {
  /** PageHeader with breadcrumb, status and save button. */
  header: ReactNode;
  /** Shown above both columns, e.g. "Gespeichert" or an error summary. */
  message?: ReactNode;
  /** Job settings, schedule and devices. */
  settings: ReactNode;
  /** The flow: step list and step form. */
  children: ReactNode;
};

/** Editor (screen 02): settings on the left, the flow on the right. */
export function EditorLayout({ header, message, settings, children }: EditorLayoutProps) {
  return (
    <>
      {header}
      {message}
      <div className="flex items-start gap-6">
        <section aria-label="Einstellungen" className="flex w-110 shrink-0 flex-col gap-6">
          {settings}
        </section>
        <section aria-label="Ablauf bearbeiten" className="flex min-w-0 flex-1 flex-col gap-6">
          {children}
        </section>
      </div>
    </>
  );
}
