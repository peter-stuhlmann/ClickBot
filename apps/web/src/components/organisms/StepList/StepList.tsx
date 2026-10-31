import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StepItem } from '@/components/molecules/StepItem';
import { plural } from '@/lib/format';
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
};

/** The flow as an ordered list of steps; the selected one is edited next to it. */
export function StepList({
  steps,
  selectedIndex,
  error,
  onSelect,
  onAdd,
  onMove,
  onRemove,
  actions,
}: StepListProps) {
  return (
    <Card
      title="Ablauf"
      description={steps.length > 0 ? plural(steps.length, 'Schritt', 'Schritte') : 'Noch leer'}
    >
      {steps.length > 0 && (
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={step.key}>
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
