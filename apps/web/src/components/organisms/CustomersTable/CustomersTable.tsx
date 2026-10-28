import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import type { CustomerRowView, Tone } from '@/lib/views';

const RATE_COLOUR: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-text-muted',
};

// Column widths from the Figma table; "Wochen-PDF" is left out until the PDF exists.
const COLUMNS = [
  { label: 'Kunde', width: 'w-80' },
  { label: 'Jobs', width: 'w-40' },
  { label: 'Läufe (30 Tage)', width: 'w-50' },
  { label: 'Letzter Lauf', width: 'w-47.5' },
  { label: 'Erfolgsquote', width: 'w-27.5' },
];

export type CustomersTableProps = { rows: CustomerRowView[] };

/** Screen 10: customers with their jobs, runs of 30 days and last run. */
export function CustomersTable({ rows }: CustomersTableProps) {
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
                Noch keine Kunden. Lege den ersten Kunden an, um Jobs für ihn zu erstellen.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-divider last:border-0">
              <td className="py-3.5 pl-5">
                <div className="truncate text-body font-medium text-text">{row.name}</div>
                <div className="truncate font-mono text-small text-text-muted">{row.websites}</div>
              </td>
              <td className="py-3.5">
                <div className="text-body text-text">{row.jobs.primary}</div>
                <div className="text-small text-text-muted">{row.jobs.secondary}</div>
              </td>
              <td className="py-3.5">
                <div className="mb-1.5 text-meta text-text">{row.runs.label}</div>
                <ProgressBar value={row.runs.value} label={`Erfolgreiche Läufe ${row.name}`} />
              </td>
              <td className="py-3.5">
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
              <td className="py-3.5 pr-5">
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
