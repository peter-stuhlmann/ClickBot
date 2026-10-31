import { Card } from '@/components/atoms/Card';
import { Textarea } from '@/components/atoms/Textarea';
import { Field } from '@/components/molecules/Field';
import { GOAL_HINT } from '@/lib/step-view';

export type GoalCardProps = {
  goal: string;
  error?: string;
  onChange: (goal: string) => void;
};

const PLACEHOLDER =
  'z. B. Auf der Startseite gibt es einen blauen Button „Newsletter abonnieren“. Ein Klick öffnet ein Feld für die E-Mail. Ungültige Adressen werden abgelehnt.';

/** A free test: only its goal; the AI finds the way in every run and judges each sub-goal. */
export function GoalCard({ goal, error, onChange }: GoalCardProps) {
  return (
    <Card title="Ziel des Tests">
      <Field id="test-goal" label="Was soll auf der Website gelten?" hint={GOAL_HINT} error={error}>
        {(control) => (
          <Textarea
            {...control}
            rows={5}
            maxLength={2000}
            placeholder={PLACEHOLDER}
            value={goal}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </Field>
      <p className="text-small text-text-muted">
        Jeder Lauf schickt Seitenaufbau und Bildschirmfotos an deinen KI-Anbieter (Einstellungen →
        KI &amp; API). Er braucht ein Modell, das Bilder versteht.
      </p>
    </Card>
  );
}
