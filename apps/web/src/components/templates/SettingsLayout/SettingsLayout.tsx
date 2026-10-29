import type { ReactNode } from 'react';

export type SettingsLayoutProps = {
  /** PageHeader "Einstellungen" with the description of the open tab. */
  header: ReactNode;
  /** Tabs of the settings area. */
  tabs: ReactNode;
  /** Hints on the right, e.g. how keys are protected. */
  aside?: ReactNode;
  children: ReactNode;
};

/** Settings pages (screens 08a–08c): header, tabs, then main column and hint column, below `xl`
 * the hints underneath. */
export function SettingsLayout({ header, tabs, aside, children }: SettingsLayoutProps) {
  return (
    <>
      {header}
      {tabs}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex max-w-3xl min-w-0 flex-1 flex-col gap-6">{children}</div>
        {aside && (
          <aside
            aria-label="Hinweise"
            className="flex max-w-3xl flex-col gap-4 xl:w-90 xl:shrink-0"
          >
            {aside}
          </aside>
        )}
      </div>
    </>
  );
}
