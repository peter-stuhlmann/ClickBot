import { StatCard } from '@/components/molecules/StatCard';
import type { StatCardView } from '@/lib/views';

export type StatGridProps = { cards: StatCardView[] };

export function StatGrid({ cards }: StatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
