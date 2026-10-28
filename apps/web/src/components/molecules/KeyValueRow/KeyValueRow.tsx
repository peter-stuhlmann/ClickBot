import type { SummaryRowView } from '@/lib/views';

export type KeyValueRowProps = SummaryRowView;

/** Label left, value right. Must sit inside a <dl>. */
export function KeyValueRow({ label, value }: KeyValueRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-meta text-text-muted">{label}</dt>
      <dd className="text-right text-body font-medium text-text">{value}</dd>
    </div>
  );
}
