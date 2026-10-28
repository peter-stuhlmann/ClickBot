import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Card } from '@/components/atoms/Card';
import { Pager, type PagerProps } from '@/components/molecules/Pager';
import { cn } from '@/lib/cn';
import type { RunListRowView } from '@/lib/views';

// "Standort" from the design is left out until location profiles exist; the device sits below
// the job, so the job column keeps its width next to the filters.
const COLUMNS = [
  { label: 'Job · Lauf', width: 'w-auto' },
  { label: 'Kunde', width: 'w-32' },
  { label: 'Zeitpunkt · Dauer', width: 'w-40' },
  { label: 'Ergebnis', width: 'w-32' },
];

export type RunsTableProps = {
  rows: RunListRowView[];
  /** "1–50 von 1.240 · neueste zuerst" */
  summary: string;
  pager: PagerProps;
};

/** Screen 14: runs of all jobs; each row opens the report of its run. */
export function RunsTable({ rows, summary, pager }: RunsTableProps) {
  return (
    <Card
      title="Läufe"
      aside={<span className="shrink-0 text-meta text-text-muted">{summary}</span>}
    >
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="border-b border-border">
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={`${column.width} pb-3 text-label font-semibold text-text-muted uppercase`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-10 text-center text-text-muted">
                Keine Läufe für diese Filter.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-divider last:border-0',
                row.failed && 'bg-danger-soft',
              )}
            >
              <td className="py-3 pr-3">
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
                  <span className="block truncate text-small text-text-muted">{row.detail}</span>
                </Link>
              </td>
              <td className="truncate py-3 pr-3 text-body text-text">{row.customer}</td>
              <td
                className={cn(
                  'py-3 pr-3 font-mono text-small',
                  row.failed ? 'text-danger' : 'text-text-muted',
                )}
              >
                {row.when} · {row.duration}
              </td>
              <td className="py-3">
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
