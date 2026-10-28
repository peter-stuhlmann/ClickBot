import type { ReactNode } from 'react';

export type ReportLayoutProps = {
  /** PageHeader with breadcrumb and status. */
  header: ReactNode;
  /** Key figures above the content. */
  stats: ReactNode;
  /** Screenshot, notices and other details on the right. */
  aside?: ReactNode;
  children: ReactNode;
};

/** Report pages (screen 03): header, key figures, then main column and detail column. */
export function ReportLayout({ header, stats, aside, children }: ReportLayoutProps) {
  return (
    <>
      {header}
      {stats}
      <div className="flex items-start gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        {aside && (
          <aside aria-label="Details" className="flex w-110 shrink-0 flex-col gap-4">
            {aside}
          </aside>
        )}
      </div>
    </>
  );
}
