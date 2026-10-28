import type { StatCardView } from '@/lib/views';

export type StatCardProps = StatCardView;

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5"
    >
      <h2 className="text-meta font-medium text-text-muted">{label}</h2>
      <p className="text-stat font-semibold text-text">{value}</p>
      <p className="text-small text-text-muted">{hint}</p>
    </section>
  );
}
