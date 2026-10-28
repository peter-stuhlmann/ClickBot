import { Card } from '@/components/atoms/Card';
import { KeyValueRow } from '@/components/molecules/KeyValueRow';
import type { SummaryRowView } from '@/lib/views';

export type JobSummaryProps = {
  rows: SummaryRowView[];
  /** Short notice below the card, e.g. that nothing is saved yet. */
  note?: string;
};

export function JobSummary({ rows, note }: JobSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card title="Zusammenfassung">
        <dl className="flex flex-col gap-3">
          {rows.map((row) => (
            <KeyValueRow key={row.label} {...row} />
          ))}
        </dl>
      </Card>
      {note && (
        <p className="rounded-card bg-neutral-soft px-3 py-2.5 text-small text-text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
