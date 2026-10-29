import Link from 'next/link';
import { Fragment } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Card } from '@/components/atoms/Card';
import { Pager, type PagerProps } from '@/components/molecules/Pager';
import { cn } from '@/lib/cn';
import type { RunListRowView } from '@/lib/views';

// "Standort" from the design is left out until location profiles exist; the device sits below
// the job, so the job column keeps its width next to the filters.
const COLUMNS = [
  { label: 'Job · Lauf', width: 'w-auto' },
  { label: 'Projekt', width: 'w-32' },
  // Time and duration on two lines, so a narrow column never breaks inside a value.
  { label: 'Zeitpunkt · Dauer', width: 'w-32' },
  { label: 'Ergebnis', width: 'w-36' },
];

export type RunsTableProps = {
  rows: RunListRowView[];
  /** "1–50 von 1.240 · neueste zuerst" */
  summary: string;
  pager: PagerProps;
};

/**
 * Screen 14: runs of all jobs; each row opens the report of its run. Below `md` every run is a
 * block of two lines; the roles are set explicitly, because Safari drops the semantics of a table
 * shown as blocks.
 */
export function RunsTable({ rows, summary, pager }: RunsTableProps) {
  return (
    <Card
      title="Läufe"
      aside={<span className="shrink-0 text-meta text-text-muted">{summary}</span>}
    >
      <table
        role="table"
        className="block w-full border-collapse text-left md:table md:table-fixed"
      >
        <thead role="rowgroup" className="sr-only border-b border-border md:not-sr-only">
          <tr role="row">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                role="columnheader"
                scope="col"
                className={`${column.width} pb-3 text-label font-semibold text-text-muted uppercase`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block md:table-row-group">
          {rows.length === 0 && (
            <tr role="row" className="block md:table-row">
              <td
                role="cell"
                colSpan={COLUMNS.length}
                className="block py-10 text-center text-text-muted md:table-cell"
              >
                Keine Läufe für diese Filter.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              role="row"
              className={cn(
                // Dense, so the result fills the gap beside the customer on small screens.
                'grid grid-flow-row-dense grid-cols-2 gap-x-3 gap-y-1 border-b border-divider py-3 last:border-0 md:table-row md:py-0',
                row.failed && 'bg-danger-soft',
              )}
            >
              <td role="cell" className="col-span-2 min-w-0 md:py-3 md:pr-3">
                <Link
                  href={row.href}
                  className="group block rounded-chip focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-medium text-text group-hover:underline">
                      {row.jobName}
                    </span>{' '}
                    {row.testRun && (
                      <span className="shrink-0 rounded-chip bg-primary-soft px-1.5 py-0.5 text-small text-primary">
                        Testlauf
                      </span>
                    )}
                  </span>{' '}
                  {/* Breaks only between the parts, never inside "iPhone 15" or "Bot 1". */}
                  <span className="block text-small text-text-muted">
                    {row.detail.split(' · ').map((part, index) => (
                      <Fragment key={index}>
                        {index > 0 && ' · '}
                        <span className="whitespace-nowrap">{part}</span>
                      </Fragment>
                    ))}
                  </span>
                </Link>
              </td>
              <td role="cell" className="mt-1 truncate text-body text-text md:mt-0 md:py-3 md:pr-3">
                {row.customer}
              </td>
              <td
                role="cell"
                className={cn(
                  'col-span-2 font-mono text-small md:py-3 md:pr-3',
                  row.failed ? 'text-danger' : 'text-text-muted',
                )}
              >
                <span className="whitespace-nowrap">{row.when}</span>
                <span aria-hidden="true" className="md:hidden">
                  {' · '}
                </span>
                <span className="whitespace-nowrap md:block">{row.duration}</span>
              </td>
              <td role="cell" className="mt-1 justify-self-end md:mt-0 md:py-3">
                <Badge tone={row.status.tone}>{row.status.label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager {...pager} />
    </Card>
  );
}
