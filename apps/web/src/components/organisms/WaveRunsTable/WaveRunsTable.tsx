import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Card } from '@/components/atoms/Card';
import { cn } from '@/lib/cn';
import type { WaveRunRowView } from '@/lib/views';

const COLUMNS = [
  { label: 'Gerät', width: 'w-44' },
  { label: 'Browser', width: 'w-28' },
  { label: 'Ergebnis', width: 'w-36' },
  { label: 'Problem bei', width: 'w-auto' },
  { label: 'Dauer', width: 'w-24' },
];

export type WaveRunsTableProps = {
  rows: WaveRunRowView[];
  /** "7 Durchläufe · 3 fehlgeschlagen" */
  summary: string;
};

/**
 * Screen 03b: the runs of one start, a device in a browser per row, each opening its report.
 * Below `md` every run is a card; the roles are set explicitly, because Safari drops the
 * semantics of a table shown as blocks.
 */
export function WaveRunsTable({ rows, summary }: WaveRunsTableProps) {
  return (
    <Card
      title="Durchläufe dieses Starts"
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
          {rows.map((row) => (
            <tr
              key={row.id}
              role="row"
              className={cn(
                'grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-divider py-3 last:border-0 md:table-row md:py-0',
                row.failed && 'bg-danger-soft',
              )}
            >
              <td role="cell" className="min-w-0 md:py-3 md:pr-3">
                <Link
                  href={row.href}
                  className="text-body font-medium text-text hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {row.device}
                </Link>
                <span className="text-body text-text-muted md:hidden"> · {row.browser}</span>
              </td>
              <td role="cell" className="hidden text-body text-text md:table-cell md:py-3 md:pr-3">
                {row.browser}
              </td>
              <td
                role="cell"
                className="row-start-1 justify-self-end md:table-cell md:py-3 md:pr-3"
              >
                <Badge tone={row.status.tone}>{row.status.label}</Badge>
              </td>
              <td role="cell" className="col-span-2 min-w-0 md:table-cell md:py-3 md:pr-3">
                {row.failedStep || row.reason ? (
                  <>
                    {row.failedStep && (
                      <span className="block text-body font-medium text-danger">
                        {row.failedStep}
                      </span>
                    )}
                    {row.reason && (
                      <span className="block text-small text-text-secondary">{row.reason}</span>
                    )}
                  </>
                ) : (
                  <span className="text-body text-text-muted">–</span>
                )}
              </td>
              <td
                role="cell"
                className={cn(
                  'col-span-2 font-mono text-small whitespace-nowrap md:table-cell md:py-3',
                  row.failed ? 'text-danger' : 'text-text-muted',
                )}
              >
                {row.duration}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
