import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type WizardStepperProps = {
  steps: readonly { label: string }[];
  /** 0-based index of the step on screen. */
  current: number;
  /** Jumps back to a finished step. */
  onSelect: (index: number) => void;
};

const chip = 'flex items-center gap-1.5 rounded-chip px-2 py-1 text-meta font-medium';

/** "✓ 1 · Website  2 · Ablauf  3 · Zeitplan …": finished steps can be revisited. */
export function WizardStepper({ steps, current, onSelect }: WizardStepperProps) {
  return (
    <nav aria-label="Schritte">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const label = `${index + 1} · ${step.label}`;
          if (index < current) {
            return (
              <li key={step.label}>
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className={cn(
                    chip,
                    'bg-success-soft text-success hover:underline',
                    'focus-visible:outline-2 focus-visible:outline-primary',
                  )}
                >
                  <Icon name="check" size={16} />
                  {label} <span className="sr-only">(erledigt)</span>
                </button>
              </li>
            );
          }
          return (
            <li key={step.label}>
              <span
                aria-current={index === current ? 'step' : undefined}
                className={cn(
                  chip,
                  index === current
                    ? 'bg-primary text-on-primary'
                    : 'bg-neutral-soft text-text-muted',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
