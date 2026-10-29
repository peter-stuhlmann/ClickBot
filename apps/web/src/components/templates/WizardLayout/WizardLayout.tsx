import type { ReactNode } from 'react';
import { ActionBar } from '@/components/atoms/ActionBar';
import { PageHeader } from '@/components/organisms/PageHeader';

export type WizardLayoutProps = {
  title: string;
  /** E.g. "Schritt 2 von 4 · Wie soll der Ablauf entstehen?" */
  subtitle: string;
  /** Zurück / Weiter buttons. */
  actions: ReactNode;
  stepper: ReactNode;
  /** Summary column on the right. */
  aside: ReactNode;
  children: ReactNode;
};

/**
 * Page header with step navigation, the form of the current step and a summary beside it; below
 * `xl` the summary comes after the form. The buttons sit beside the title from `xl` on; below that
 * they are a bar at the bottom of the window, so "Weiter" is at hand after a long step.
 */
export function WizardLayout({
  title,
  subtitle,
  actions,
  stepper,
  aside,
  children,
}: WizardLayoutProps) {
  return (
    // From `xl` a wrapping row: title and buttons, then the content on a line of its own.
    <div className="flex flex-col gap-6 xl:flex-row xl:flex-wrap xl:items-center">
      <div className="min-w-0 xl:flex-1">
        <PageHeader title={title} description={subtitle} />
      </div>
      <ActionBar>{actions}</ActionBar>
      <div className="flex min-w-0 flex-col gap-6 xl:basis-full xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {stepper}
          {children}
        </div>
        <aside
          aria-label="Zusammenfassung"
          className="flex flex-col gap-4 xl:sticky xl:top-8 xl:w-90 xl:shrink-0"
        >
          {aside}
        </aside>
      </div>
    </div>
  );
}
