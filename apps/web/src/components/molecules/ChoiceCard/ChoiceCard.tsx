import { Icon, type IconName } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type ChoiceCardProps = {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  /** Shown instead of the click action, e.g. "geplant" for something not built yet. */
  unavailable?: string;
  onClick?: () => void;
};

/** Large selectable card, e.g. a device or the way a flow is created. */
export function ChoiceCard({
  icon,
  title,
  description,
  selected,
  unavailable,
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={unavailable !== undefined}
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-start gap-3 rounded-card p-5 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-2 border-primary bg-primary-soft'
          : 'border border-border bg-surface hover:border-border-strong',
      )}
    >
      <Icon name={icon} className={selected ? 'text-primary' : 'text-text-muted'} />
      <span className="flex max-w-full items-start gap-1.5 text-card font-medium text-text">
        {selected && <Icon name="check" size={16} className="mt-0.75 text-primary" />}
        {/* Long German words like "zusammenklicken" must not overflow the narrow cards. */}
        <span className="min-w-0 hyphens-auto">{title}</span>
      </span>
      <span className="text-meta text-text-muted">{description}</span>
      {unavailable && (
        <span className="rounded-chip bg-neutral-soft px-2 py-0.5 text-small text-text-muted">
          {unavailable}
        </span>
      )}
    </button>
  );
}
