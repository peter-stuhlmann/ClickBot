import { Badge } from '@/components/atoms/Badge';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { Toggle } from '@/components/atoms/Toggle';
import type { JobRowView, Tone } from '@/lib/views';

const RATE_COLOUR: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-text-muted',
};

// Column widths from the Figma table (320/160/190/190/110/110 px).
const COLUMNS = [
  { label: 'Job', width: 'w-80' },
  { label: 'Zeitplan', width: 'w-40' },
  { label: 'Fortschritt', width: 'w-47.5' },
  { label: 'Letzter Lauf', width: 'w-47.5' },
  { label: 'Erfolgsquote', width: 'w-27.5' },
  { label: 'Status', width: 'w-27.5' },
];

export type JobsTableProps = {
  rows: JobRowView[];
  /** Server action; receives `jobId` and the requested state `active` ("true"/"false"). */
  toggleAction: (formData: FormData) => void | Promise<void>;
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
    <Toggle
      checked={status.active}
      disabled={!status.toggleable}
      type={status.toggleable ? 'submit' : 'button'}
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

export function JobsTable({ rows, toggleAction }: JobsTableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="border-b border-border bg-subtle">
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={`${column.width} py-3 text-label font-semibold text-text-muted uppercase first:pl-5 last:pr-5`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-5 py-10 text-center text-text-muted">
                Noch keine Jobs. Lege den ersten Job an, um eine Website automatisch zu testen.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-divider last:border-0">
              <td className="py-3.5 pl-5">
                <div className="truncate text-body font-medium text-text">{row.name}</div>
                <div className="mt-0.5 truncate font-mono text-small text-text-muted">
                  {row.url}
                </div>
              </td>
              <td className="py-3.5">
                <div className="text-body text-text">{row.schedule.primary}</div>
                <div className="mt-0.5 text-small text-text-muted">{row.schedule.secondary}</div>
              </td>
              <td className="py-3.5">
                <div className="text-meta text-text">{row.progress.label}</div>
                <div className="mt-2.5">
                  <ProgressBar value={row.progress.value} label={`Fortschritt ${row.name}`} />
                </div>
              </td>
              <td className="py-3.5">
                {row.lastRun ? (
                  <>
                    <Badge tone={row.lastRun.tone}>{row.lastRun.label}</Badge>
                    <div className="mt-1 text-small text-text-muted">{row.lastRun.when}</div>
                  </>
                ) : (
                  <span className="text-small text-text-muted">noch kein Lauf</span>
                )}
              </td>
              <td className="py-3.5">
                {row.successRate ? (
                  <span className={`text-body font-semibold ${RATE_COLOUR[row.successRate.tone]}`}>
                    {row.successRate.text}
                  </span>
                ) : (
                  <span className="text-body text-text-muted">–</span>
                )}
              </td>
              <td className="py-3.5 pr-5">
                <StatusCell row={row} toggleAction={toggleAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
