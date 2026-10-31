import { Card } from '@/components/atoms/Card';
import type { IconName } from '@/components/atoms/Icon';
import { ChoiceCard } from '@/components/molecules/ChoiceCard';

/** fixed: recorded steps, the same in every run · free: a goal the AI checks in every run. */
export type FlowMethod = 'fixed' | 'free';

const METHODS: { key: FlowMethod; icon: IconName; title: string; description: string }[] = [
  {
    key: 'fixed',
    icon: 'record',
    title: 'Fester Ablauf',
    description:
      'Du klickst dich einmal im Browser durch die Seite. Jeder Lauf wiederholt genau diese Schritte.',
  },
  {
    key: 'free',
    icon: 'sparkles',
    title: 'Frei mit KI',
    description:
      'Du beschreibst das Ziel. Die KI sucht den Weg in jedem Lauf selbst und bewertet jedes Teilziel.',
  },
];

export type MethodPickerProps = {
  method: FlowMethod;
  onChoose: (method: FlowMethod) => void;
};

/**
 * How a job tests (screen 05). Writing code is deliberately not offered: own code would run on
 * the server next to keys and database.
 */
export function MethodPicker({ method, onChoose }: MethodPickerProps) {
  return (
    <Card title="Wie soll getestet werden?">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {METHODS.map(({ key, ...card }) => (
          <ChoiceCard
            key={card.title}
            {...card}
            selected={key === method}
            onClick={() => onChoose(key)}
          />
        ))}
      </div>
    </Card>
  );
}
