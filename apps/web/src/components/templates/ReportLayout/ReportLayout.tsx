import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ReportLayoutProps = {
  /** PageHeader with breadcrumb and status. */
  header: ReactNode;
  /** Key figures above the content. */
  stats: ReactNode;
  /** Screenshot, notices and other details on the right. */
  aside?: ReactNode;
  /** Accessible name of the detail column. */
  asideLabel?: string;
  /** A narrower detail column, e.g. for filters next to a wide table. */
  narrowAside?: boolean;
  children: ReactNode;
};

/**
 * Report pages (screen 03): header, key figures, then main column and detail column; below `xl`
 * one above the other.
 */
export function ReportLayout({
  header,
  stats,
  aside,
  asideLabel = 'Details',
  narrowAside = false,
  children,
}: ReportLayoutProps) {
  return (
    <>
      {header}
      {stats}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        {aside && (
          <aside
            aria-label={asideLabel}
            className={cn(
              'flex flex-col gap-4 xl:shrink-0',
              // Filters belong above the table they filter when there is no room beside it, and
              // stay in view beside it while the table scrolls.
              narrowAside ? 'order-first xl:sticky xl:top-8 xl:order-none xl:w-80' : 'xl:w-110',
            )}
          >
            {aside}
          </aside>
        )}
      </div>
    </>
  );
}
