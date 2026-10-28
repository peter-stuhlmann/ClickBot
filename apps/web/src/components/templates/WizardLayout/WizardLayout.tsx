import type { ReactNode } from 'react';
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

/** Page header with step navigation, the form of the current step and a summary beside it. */
export function WizardLayout({
  title,
  subtitle,
  actions,
  stepper,
  aside,
  children,
}: WizardLayoutProps) {
  return (
    <>
      <PageHeader title={title} description={subtitle} actions={actions} />
      <div className="flex items-start gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {stepper}
          {children}
        </div>
        <aside
          aria-label="Zusammenfassung"
          className="sticky top-8 flex w-90 shrink-0 flex-col gap-4"
        >
          {aside}
        </aside>
      </div>
    </>
  );
}
