import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StepItem } from '@/components/molecules/StepItem';
import { plural } from '@/lib/format';
import type { InsertableStepType } from '@/lib/job-draft';
import type { StepItemView } from '@/lib/views';

export type StepListProps = {
  steps: { key: string; view: StepItemView; invalid: boolean }[];
  selectedIndex: number | null;
  /** Problem with the list as a whole, e.g. "mindestens einen Schritt". */
  error?: string;
  onSelect: (index: number) => void;
  /** Without it there is no "Schritt hinzufügen", e.g. for a recorded flow. */
  onAdd?: () => void;
  /** Buttons below the list, e.g. "Neu aufnehmen". */
  actions?: ReactNode;
  /** Moves a step one place up (-1) or down (+1). */
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
  /** Puts a wait or a screenshot after the step at `index`; without it there are no buttons. */
  onInsert?: (index: number, type: InsertableStepType) => void;
};

const INSERTS: { type: InsertableStepType; icon: 'clock' | 'camera'; label: string }[] = [
  { type: 'wait', icon: 'clock', label: 'Warten' },
  { type: 'screenshot', icon: 'camera', label: 'Bildschirmfoto' },
];

/**
 * Between two steps: "Warten" and "Bildschirmfoto". With a mouse they show on hover over the step
 * above or with the keyboard focus, so the list stays calm; on a touch screen always, in a line of
 * their own.
 */
function InsertButtons({
  number,
  onInsert,
}: {
  number: number;
  onInsert: (type: InsertableStepType) => void;
}) {
  return (
    <div className="flex h-9 items-center gap-2 transition-opacity pointer-fine:relative pointer-fine:z-10 pointer-fine:h-2 pointer-fine:opacity-0 pointer-fine:group-focus-within/step:opacity-100 pointer-fine:group-hover/step:opacity-100">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      {INSERTS.map(({ type, icon, label }) => (
        <button
          key={type}
          type="button"
          title={`${label} einfügen`}
          aria-label={`${label} nach Schritt ${number} einfügen`}
          onClick={() => onInsert(type)}
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-tab transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name={icon} size={16} />
        </button>
      ))}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

/** The flow as an ordered list of steps; the selected one is edited next to it. */
export function StepList({
  steps,
  selectedIndex,
  error,
  onSelect,
  onAdd,
  onMove,
  onRemove,
  onInsert,
  actions,
}: StepListProps) {
  return (
    <Card
      title="Ablauf"
      description={steps.length > 0 ? plural(steps.length, 'Schritt', 'Schritte') : 'Noch leer'}
    >
      {steps.length > 0 && (
        <ol className={onInsert ? 'flex flex-col' : 'flex flex-col gap-2'}>
          {steps.map((step, index) => (
            <li key={step.key} className="group/step">
              <StepItem
                index={index}
                step={step.view}
                selected={index === selectedIndex}
                invalid={step.invalid}
                onSelect={() => onSelect(index)}
                onMoveUp={index > 0 ? () => onMove(index, -1) : undefined}
                onMoveDown={index < steps.length - 1 ? () => onMove(index, 1) : undefined}
                onRemove={() => onRemove(index)}
              />
              {onInsert && (
                <InsertButtons number={index + 1} onInsert={(type) => onInsert(index, type)} />
              )}
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-small text-danger">{error}</p>}
      {onAdd && (
        <Button
          variant="secondary"
          fullWidth
          className="border-dashed text-text-muted"
          icon={<Icon name="plus" size={16} />}
          onClick={onAdd}
        >
          Schritt hinzufügen
        </Button>
      )}
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </Card>
  );
}
