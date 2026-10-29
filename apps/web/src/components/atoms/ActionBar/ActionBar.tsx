import type { ReactNode } from 'react';

export type ActionBarProps = { children: ReactNode };

/**
 * The buttons of a form page (wizard, editor). From `xl` on a plain row beside the title; below
 * that a bar at the bottom of the window, so "Weiter" or "Speichern" is at hand after a long form.
 * It moves itself to the end of its flex column (order-last) and reaches to the edges of the page
 * with the negative margins of the AppShell padding.
 */
export function ActionBar({ children }: ActionBarProps) {
  return (
    <div className="sticky bottom-0 z-20 order-last -mx-4 grid auto-cols-fr grid-flow-col gap-3 border-t border-border bg-surface px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:static xl:order-none xl:mx-0 xl:flex xl:border-0 xl:bg-transparent xl:p-0">
      {children}
    </div>
  );
}
