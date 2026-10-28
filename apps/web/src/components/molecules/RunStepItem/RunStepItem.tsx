import { cva } from 'class-variance-authority';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';
import type { RunStepStatus, RunStepView } from '@/lib/views';

const STATUS: Record<RunStepStatus, { icon: IconName; label: string }> = {
  passed: { icon: 'check', label: 'bestanden' },
  healed: { icon: 'check', label: 'mit KI-Hilfe bestanden' },
  failed: { icon: 'close', label: 'fehlgeschlagen' },
  skipped: { icon: 'minus', label: 'übersprungen' },
  pending: { icon: 'clock', label: 'noch offen' },
};

const badge = cva('flex size-7 shrink-0 items-center justify-center rounded-full', {
  variants: {
    status: {
      passed: 'bg-success-soft text-success',
      healed: 'bg-warning-soft text-warning',
      failed: 'bg-danger-soft text-danger',
      skipped: 'bg-neutral-soft text-text-subtle',
      pending: 'bg-neutral-soft text-text-subtle',
    },
  },
});

export type RunStepItemProps = RunStepView;

/** One step of a run: status, what it did, how long it took and its screenshot. */
export function RunStepItem({
  number,
  status,
  title,
  detail,
  duration,
  screenshotUrl,
}: RunStepItemProps) {
  const { icon, label } = STATUS[status];
  const muted = status === 'skipped' || status === 'pending';
  return (
    <div className="flex items-center gap-4 py-3.5">
      <span className={badge({ status })}>
        <Icon name={icon} size={16} />
        <span className="sr-only">
          Schritt {number} {label}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-body font-medium', muted ? 'text-text-muted' : 'text-text')}>
          {title}
        </span>
        {detail && (
          <span
            className={cn(
              'truncate text-meta',
              status === 'failed' && 'text-danger',
              status === 'healed' && 'text-warning',
              (status === 'passed' || muted) && 'font-mono text-small text-text-muted',
            )}
          >
            {detail}
          </span>
        )}
      </div>
      <span className="shrink-0 font-mono text-small text-text-muted">{duration}</span>
      {screenshotUrl && (
        <a
          href={screenshotUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-chip text-meta font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Bildschirmfoto <span className="sr-only">von Schritt {number}</span>
        </a>
      )}
    </div>
  );
}
