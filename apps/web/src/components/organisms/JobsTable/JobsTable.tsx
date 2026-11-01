import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { SubmitButton } from '@/components/molecules/SubmitButton';
import { SubmitToggle } from '@/components/molecules/SubmitToggle';
import type { JobRowView, Tone } from '@/lib/views';

const RATE_COLOUR: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-text-muted',
};

// Column widths close to the Figma table (320/160/190/190/110/110 of 1080 px), with more room
// for the status, so toggle and "Beendet" still fit at 1280 px.
const COLUMNS = [
  { label: 'Test', width: 'w-1/4' },
  { label: 'Zeitplan', width: 'w-7/50' },
  { label: 'Fortschritt', width: 'w-9/50' },
  { label: 'Letzter Durchlauf', width: 'w-17/100' },
  { label: 'Erfolgsquote', width: 'w-3/25' },
  { label: 'Status', width: 'w-7/50' },
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

export type JobsTableProps = {
  rows: JobRowView[];
  /** Server action; receives `jobId` and the requested state `active` ("true"/"false"). */
  toggleAction: (formData: FormData) => void | Promise<void>;
  /** Server action; receives `jobId`, runs the test once and opens the report. */
  runAction: (formData: FormData) => void | Promise<void>;
};

function StatusCell({
  row,
  toggleAction,
}: {
  row: JobRowView;
  toggleAction: JobsTableProps['toggleAction'];
}) {
  const { status } = row;
  const toggle = (
    <SubmitToggle
      checked={status.active}
      disabled={!status.toggleable}
      label={
        status.toggleable
          ? `${row.name} ${status.active ? 'pausieren' : 'fortsetzen'}`
          : `${row.name}: ${status.label}`
      }
    />
  );

  return (
    <div className="flex items-center gap-2">
      {status.toggleable ? (
        <form action={toggleAction}>
          <input type="hidden" name="jobId" value={row.id} />
          <input type="hidden" name="active" value={String(!status.active)} />
          {toggle}
        </form>
      ) : (
        toggle
      )}
      <span className="text-meta font-medium text-text">{status.label}</span>
    </div>
  );
}

/**
 * The job list. Below `xl` every row is a card with the columns in two columns; the roles are set
 * explicitly, because Safari drops the table semantics of a table shown as blocks.
 */
export function JobsTable({ rows, toggleAction, runAction }: JobsTableProps) {
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
                Noch keine Tests. Lege den ersten Test an, um eine Website automatisch zu testen.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              role="row"
              // Dense, so "Letzter Lauf" fills the gap beside "Zeitplan" on small screens.
              className="grid grid-flow-row-dense grid-cols-2 gap-x-4 gap-y-3 border-b border-divider p-4 last:border-0 xl:table-row xl:p-0"
            >
              <td role="cell" className="col-span-2 min-w-0 xl:py-3.5 xl:pr-4 xl:pl-5">
                <Link
                  href={`/jobs/${row.id}`}
                  className="block truncate rounded-chip text-body font-medium text-text hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {row.name}
                </Link>
                <div className="mt-0.5 truncate text-small text-text-muted">
                  <span className="font-medium text-text-secondary">{row.campaign}</span>
                  {' · '}
                  <span className="font-mono">{row.url}</span>
                </div>
              </td>
              <td role="cell" className="xl:py-3.5">
                <CellLabel>Zeitplan</CellLabel>
                <div className="text-body text-text">{row.schedule.primary}</div>
                <div className="mt-0.5 text-small text-text-muted">{row.schedule.secondary}</div>
              </td>
              <td role="cell" className="col-span-2 xl:py-3.5">
                <CellLabel>Fortschritt</CellLabel>
                <div className="text-meta text-text">{row.progress.label}</div>
                <div className="mt-2.5">
                  <ProgressBar value={row.progress.value} label={`Fortschritt ${row.name}`} />
                </div>
              </td>
              <td role="cell" className="xl:py-3.5">
                <CellLabel>Letzter Durchlauf</CellLabel>
                {row.lastRun ? (
                  <Link
                    href={row.lastRun.href}
                    aria-label={`Letzter Durchlauf von ${row.name}: ${row.lastRun.label}, ${row.lastRun.when}`}
                    className="group inline-flex flex-col items-start rounded-input focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Badge tone={row.lastRun.tone}>{row.lastRun.label}</Badge>
                    <span className="mt-1 text-small text-text-muted group-hover:underline">
                      {row.lastRun.when}
                    </span>
                  </Link>
                ) : (
                  <span className="text-small text-text-muted">noch kein Durchlauf</span>
                )}
              </td>
              <td role="cell" className="xl:py-3.5">
                <CellLabel>Erfolgsquote</CellLabel>
                {row.successRate ? (
                  <span className={`text-body font-semibold ${RATE_COLOUR[row.successRate.tone]}`}>
                    {row.successRate.text}
                  </span>
                ) : (
                  <span className="text-body text-text-muted">–</span>
                )}
              </td>
              <td role="cell" className="xl:py-3.5 xl:pr-5">
                <CellLabel>Status</CellLabel>
                <div className="flex items-center justify-between gap-2">
                  <StatusCell row={row} toggleAction={toggleAction} />
                  <form action={runAction}>
                    <input type="hidden" name="jobId" value={row.id} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      aria-label={`${row.name} jetzt ausführen`}
                      title="Jetzt auf allen Geräten und Browsern ausführen und den Report öffnen"
                      icon={<Icon name="play" size={16} />}
                    />
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
