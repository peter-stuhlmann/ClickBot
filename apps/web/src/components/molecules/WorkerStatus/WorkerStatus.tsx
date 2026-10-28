import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';

export type WorkerStatusProps = {
  online: boolean;
  activeRuns: number;
};

export function WorkerStatus({ online, activeRuns }: WorkerStatusProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-input bg-sidebar-active px-3 py-2.5 text-small text-sidebar-text"
    >
      <span
        aria-hidden="true"
        data-testid="worker-dot"
        className={cn('size-2 shrink-0 rounded-full', online ? 'bg-online' : 'bg-sidebar-muted')}
      />
      {online
        ? `Worker online · ${plural(activeRuns, 'Lauf', 'Läufe')} aktiv`
        : 'Worker offline – Läufe warten'}
    </div>
  );
}
