import { Card } from '@/components/atoms/Card';
import type { IconName } from '@/components/atoms/Icon';
import { ChoiceCard } from '@/components/molecules/ChoiceCard';

const METHODS: { icon: IconName; title: string; description: string; planned: boolean }[] = [
  {
    icon: 'sparkles',
    title: 'Mit KI beschreiben',
    description:
      'Beschreibe in normaler Sprache, was passieren soll. Die KI schlägt die Schritte vor.',
    planned: true,
  },
  {
    icon: 'record',
    title: 'Im Browser aufnehmen',
    description: 'Du klickst dich live durch die Seite, jeder Klick wird ein Schritt.',
    planned: true,
  },
  {
    icon: 'list',
    title: 'Schritte zusammenklicken',
    description: 'Schritt für Schritt aus Bausteinen wie Klicken, Ausfüllen, Prüfen.',
    planned: false,
  },
  {
    icon: 'code',
    title: 'Code schreiben',
    description: 'Für Entwickler: Playwright-Code mit Variablen und Hilfsfunktionen.',
    planned: true,
  },
];

/**
 * The four ways to a flow (screen 05). Only "Schritte zusammenklicken" exists so far, so it is
 * always the chosen one; the others are shown as planned.
 */
export function MethodPicker() {
  return (
    <Card
      title="Wie soll der Ablauf entstehen?"
      description="Alle vier Wege erzeugen dieselben Schritte. Bisher gibt es das Zusammenklicken, die anderen folgen."
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {METHODS.map((method) => (
          <ChoiceCard
            key={method.title}
            icon={method.icon}
            title={method.title}
            description={method.description}
            selected={!method.planned}
            unavailable={method.planned ? 'geplant' : undefined}
          />
        ))}
      </div>
    </Card>
  );
}
