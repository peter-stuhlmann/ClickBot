import { cva } from 'class-variance-authority';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';
import type { CriterionStatus } from '@click-bot/shared';
import type { RunStepStatus, RunStepView } from '@/lib/views';

const STATUS: Record<RunStepStatus, { icon: IconName; label: string }> = {
  passed: { icon: 'check', label: 'bestanden' },
  healed: { icon: 'check', label: 'mit KI-Hilfe bestanden' },
  unclear: { icon: 'alert', label: 'nicht ganz prüfbar' },
  failed: { icon: 'close', label: 'fehlgeschlagen' },
  skipped: { icon: 'minus', label: 'übersprungen' },
  pending: { icon: 'clock', label: 'noch offen' },
};

const badge = cva('flex size-7 shrink-0 items-center justify-center rounded-full', {
  variants: {
    status: {
      passed: 'bg-success-soft text-success',
      healed: 'bg-warning-soft text-warning',
      unclear: 'bg-warning-soft text-warning',
      failed: 'bg-danger-soft text-danger',
      skipped: 'bg-neutral-soft text-text-muted',
      pending: 'bg-neutral-soft text-text-muted',
    },
  },
});

const VERDICT: Record<CriterionStatus, string> = {
  met: 'Erfüllt',
  failed: 'Nicht erfüllt',
  unknown: 'Nicht prüfbar',
};

const verdictChip = cva('w-fit shrink-0 rounded-chip px-1.5 py-0.5 text-small font-medium', {
  variants: {
    status: {
      met: 'bg-success-soft text-success',
      failed: 'bg-danger-soft text-danger',
      unknown: 'bg-warning-soft text-warning',
    },
  },
});

export type RunStepItemProps = RunStepView;

// The result of a free test, tinted like its outcome; the text stays dark for contrast.
const SUMMARY_TONE: Partial<Record<RunStepView['status'], string>> = {
  passed: 'bg-success-soft',
  failed: 'bg-danger-soft',
  unclear: 'bg-warning-soft',
};

/** One step of a run: status, what it did, how long it took and its screenshot. */
export function RunStepItem({
  number,
  status,
  title,
  detail,
  duration,
  screenshotHref,
  aiActions = [],
  aiVerdict = [],
  aiSummary,
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
              'text-meta',
              // The locator of a step that went well is one short line; what went wrong is
              // read in full, never cut off.
              status === 'passed' || muted ? 'truncate' : 'break-words',
              status === 'failed' && 'text-danger',
              (status === 'healed' || status === 'unclear') && 'text-warning',
              (status === 'passed' || muted) && 'font-mono text-small text-text-muted',
            )}
          >
            {detail}
          </span>
        )}
        {aiSummary && (
          <p
            className={cn(
              'mt-2 rounded-input px-3 py-2 text-body text-text',
              SUMMARY_TONE[status] ?? 'bg-neutral-soft',
            )}
          >
            <span className="font-semibold">Testergebnis:</span> {aiSummary}
          </p>
        )}
        {aiVerdict.length > 0 && (
          <ul aria-label="Ergebnis der KI" className="mt-2 flex flex-col gap-2">
            {aiVerdict.map((criterion, index) => (
              <li key={index} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                <span className={verdictChip({ status: criterion.status })}>
                  {VERDICT[criterion.status]}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-meta text-text">{criterion.goal}</span>
                  <span className="text-small text-text-muted">{criterion.evidence}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {aiActions.length > 0 && (
          <ol
            aria-label="Aktionen der KI"
            className="mt-1 flex list-decimal flex-col gap-0.5 pl-5 text-meta text-text-muted"
          >
            {aiActions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ol>
        )}
      </div>
      <span className="shrink-0 font-mono text-small text-text-muted">{duration}</span>
      {screenshotHref && (
        <a
          href={screenshotHref}
          className="shrink-0 rounded-chip text-meta font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Bildschirmfoto <span className="sr-only">von Schritt {number}</span>
        </a>
      )}
    </div>
  );
}
