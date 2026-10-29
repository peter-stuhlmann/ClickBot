import { Card } from '@/components/atoms/Card';
import type { IconName } from '@/components/atoms/Icon';
import { ChoiceCard } from '@/components/molecules/ChoiceCard';

/** The ways to a flow that exist so far. */
export type FlowMethod = 'ai' | 'editor';

const METHODS: { key: FlowMethod | null; icon: IconName; title: string; description: string }[] = [
  {
    key: 'ai',
    icon: 'sparkles',
    title: 'Mit KI beschreiben',
    description:
      'Beschreibe in normaler Sprache, was passieren soll. Die KI schlägt die Schritte vor.',
  },
  {
    key: null,
    icon: 'record',
    title: 'Im Browser aufnehmen',
    description: 'Du klickst dich live durch die Seite, jeder Klick wird ein Schritt.',
  },
  {
    key: 'editor',
    icon: 'list',
    title: 'Schritte zusammenklicken',
    description: 'Schritt für Schritt aus Bausteinen wie Klicken, Ausfüllen, Prüfen.',
  },
];

export type MethodPickerProps = {
  method: FlowMethod;
  onChoose: (method: FlowMethod) => void;
};

/**
 * The three ways to a flow (screen 05). Describing with AI and the step builder exist; recording
 * is shown as planned. All of them lead to the same steps. Writing code is deliberately not
 * offered: own code would run on the server next to keys and database.
 */
export function MethodPicker({ method, onChoose }: MethodPickerProps) {
  return (
    <Card
      title="Wie soll der Ablauf entstehen?"
      description="Alle Wege erzeugen dieselben Schritte. Das Aufnehmen folgt."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {METHODS.map(({ key, ...card }) => (
          <ChoiceCard
            key={card.title}
            {...card}
            selected={key === method}
            unavailable={key ? undefined : 'geplant'}
            onClick={key ? () => onChoose(key) : undefined}
          />
        ))}
      </div>
    </Card>
  );
}
