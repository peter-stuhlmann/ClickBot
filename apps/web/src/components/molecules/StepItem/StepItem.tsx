import { cva } from 'class-variance-authority';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';
import type { StepItemView } from '@/lib/views';

const typeBadge = cva(
  'w-24 shrink-0 rounded-chip px-2 py-0.75 text-center text-label font-semibold uppercase',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-soft text-text-muted',
        primary: 'bg-primary-soft text-primary',
        info: 'bg-info-soft text-info',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
      },
    },
  },
);

export type StepItemProps = {
  /** 0-based position; shown 1-based. */
  index: number;
  step: StepItemView;
  selected: boolean;
  /** The step has a validation error. */
  invalid?: boolean;
  onSelect: () => void;
  /** Omitted for the first step. */
  onMoveUp?: () => void;
  /** Omitted for the last step. */
  onMoveDown?: () => void;
  onRemove: () => void;
};

/** One row of the step list: number, type badge, title and locator, plus reorder/remove. */
export function StepItem({
  index,
  step,
  selected,
  invalid = false,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
}: StepItemProps) {
  const number = index + 1;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-step border bg-surface py-3 pr-2 pl-3',
        selected ? 'border-primary' : 'border-border',
        invalid && 'border-danger',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Schritt ${number}: ${step.title}`}
        onClick={onSelect}
        // Below `sm` title and locator get a line of their own, so they are not cut after a word.
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-input text-left focus-visible:outline-2 focus-visible:outline-primary sm:flex-nowrap"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-soft text-small font-semibold text-text-secondary">
          {number}
        </span>
        <span className={typeBadge({ tone: step.tone })}>{step.typeLabel}</span>
        <span className="flex min-w-0 basis-full flex-col gap-0.5 sm:basis-auto">
          <span className="truncate text-body font-medium text-text">{step.title}</span>
          <span className="truncate font-mono text-small text-text-muted">{step.detail}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          aria-label={`Schritt ${number} nach oben`}
          disabled={!onMoveUp}
          onClick={onMoveUp}
          icon={<Icon name="arrowUp" size={16} />}
        />
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          aria-label={`Schritt ${number} nach unten`}
          disabled={!onMoveDown}
          onClick={onMoveDown}
          icon={<Icon name="arrowDown" size={16} />}
        />
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          aria-label={`Schritt ${number} löschen`}
          onClick={onRemove}
          icon={<Icon name="trash" size={16} />}
        />
      </div>
    </div>
  );
}
