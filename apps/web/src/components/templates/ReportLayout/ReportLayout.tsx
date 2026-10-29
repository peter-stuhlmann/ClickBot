import type { ReactNode } from 'react';

export type ReportLayoutProps = {
  /** PageHeader with breadcrumb and status. */
  header: ReactNode;
  /** Key figures above the content. */
  stats: ReactNode;
  /** Screenshot, notices and other details on the right. */
  aside?: ReactNode;
  /** Accessible name of the detail column. */
  asideLabel?: string;
  /** Details above the content instead of beside it, sticky while it scrolls: filters of a wide table. */
  asideOnTop?: boolean;
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
  asideOnTop = false,
  children,
}: ReportLayoutProps) {
  if (asideOnTop) {
    return (
      <>
        {header}
        {stats}
        <div className="flex flex-col gap-6">
          {aside && (
            <aside
              aria-label={asideLabel}
              className="flex flex-col gap-4 lg:sticky lg:top-0 lg:z-10"
            >
              {aside}
            </aside>
          )}
          <div className="flex min-w-0 flex-col gap-6">{children}</div>
        </div>
      </>
    );
  }
  return (
    <>
      {header}
      {stats}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        {aside && (
          <aside aria-label={asideLabel} className="flex flex-col gap-4 xl:w-110 xl:shrink-0">
            {aside}
          </aside>
        )}
      </div>
    </>
  );
}
