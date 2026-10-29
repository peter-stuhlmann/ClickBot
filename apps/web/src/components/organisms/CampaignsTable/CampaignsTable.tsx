import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import type { CampaignRowView, Tone } from '@/lib/views';

const RATE_COLOUR: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-text-muted',
};

// Column widths in the ratio of the Figma customer table (320/160/200/190/110 px), now one row per
// campaign of the current project; "Wochen-PDF" is left out until the PDF exists.
const COLUMNS = [
  { label: 'Kampagne', width: 'w-16/49' },
  { label: 'Jobs', width: 'w-8/49' },
  { label: 'Läufe (30 Tage)', width: 'w-10/49' },
  { label: 'Letzter Lauf', width: 'w-19/98' },
  { label: 'Erfolgsquote', width: 'w-11/98' },
];

/** Column name inside a card on small screens; screen readers get the column header instead. */
function CellLabel({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className="mb-1 block text-label font-semibold text-text-muted uppercase xl:hidden"
    >
      {children}
    </span>
  );
}

export type CampaignsTableProps = { rows: CampaignRowView[] };

/**
 * The campaigns of the current project with their jobs, runs of 30 days and last run. Below `xl`
 * every row is a card; the roles are set explicitly, because Safari drops the semantics of a table
 * shown as blocks.
 */
export function CampaignsTable({ rows }: CampaignsTableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <table
        role="table"
        className="block w-full border-collapse text-left xl:table xl:table-fixed"
      >
        <thead role="rowgroup" className="sr-only border-b border-border bg-subtle xl:not-sr-only">
          <tr role="row">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                role="columnheader"
                scope="col"
                className={`${column.width} py-3 text-label font-semibold text-text-muted uppercase first:pl-5 last:pr-5`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block xl:table-row-group">
          {rows.length === 0 && (
            <tr role="row" className="block xl:table-row">
              <td
                role="cell"
                colSpan={COLUMNS.length}
                className="block px-5 py-10 text-center text-text-muted xl:table-cell"
              >
                Noch keine Kampagnen. Lege die erste Kampagne an, um Jobs darin zu erstellen.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              role="row"
              // Dense, so "Letzter Lauf" fills the gap beside "Jobs" on small screens.
              className="grid grid-flow-row-dense grid-cols-2 gap-x-4 gap-y-3 border-b border-divider p-4 last:border-0 xl:table-row xl:p-0"
            >
              <td role="cell" className="col-span-2 min-w-0 xl:py-3.5 xl:pr-4 xl:pl-5">
                <Link
                  href={`/kampagnen/${row.id}`}
                  className="block truncate rounded-chip text-body font-medium text-text hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {row.name}
                </Link>
                <div className="truncate font-mono text-small text-text-muted">{row.detail}</div>
              </td>
              <td role="cell" className="xl:py-3.5">
                <CellLabel>Jobs</CellLabel>
                <div className="text-body text-text">{row.jobs.primary}</div>
                <div className="text-small text-text-muted">{row.jobs.secondary}</div>
              </td>
              <td role="cell" className="col-span-2 xl:py-3.5">
                <CellLabel>Läufe (30 Tage)</CellLabel>
                <div className="mb-1.5 text-meta text-text">{row.runs.label}</div>
                <ProgressBar value={row.runs.value} label={`Erfolgreiche Läufe ${row.name}`} />
              </td>
              <td role="cell" className="xl:py-3.5">
                <CellLabel>Letzter Lauf</CellLabel>
                {row.lastRun ? (
                  <Link
                    href={row.lastRun.href}
                    aria-label={`Letzter Lauf von ${row.name}: ${row.lastRun.label}, ${row.lastRun.when}`}
                    className="group inline-flex flex-col items-start rounded-input focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Badge tone={row.lastRun.tone}>{row.lastRun.label}</Badge>
                    <span className="mt-1 text-small text-text-muted group-hover:underline">
                      {row.lastRun.when}
                    </span>
                  </Link>
                ) : (
                  <span className="text-small text-text-muted">noch kein Lauf</span>
                )}
              </td>
              <td role="cell" className="xl:py-3.5 xl:pr-5">
                <CellLabel>Erfolgsquote</CellLabel>
                {row.successRate ? (
                  <span className={`text-body font-semibold ${RATE_COLOUR[row.successRate.tone]}`}>
                    {row.successRate.text}
                  </span>
                ) : (
                  <span className="text-body text-text-muted">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
