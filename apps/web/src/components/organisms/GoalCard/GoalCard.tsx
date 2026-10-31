import Link from 'next/link';
import { Card } from '@/components/atoms/Card';
import { Textarea } from '@/components/atoms/Textarea';
import { Field } from '@/components/molecules/Field';
import { Notice } from '@/components/molecules/Notice';
import { GOAL_HINT } from '@/lib/step-view';

export type GoalCardProps = {
  goal: string;
  error?: string;
  /** A default AI provider is set up; without one every run of a free test fails. */
  aiReady: boolean;
  onChange: (goal: string) => void;
};

const PLACEHOLDER =
  'z. B. Auf der Startseite gibt es einen blauen Button „Newsletter abonnieren“. Ein Klick öffnet ein Feld für die E-Mail. Ungültige Adressen werden abgelehnt.';

/** A free test: only its goal; the AI finds the way in every run and judges each sub-goal. */
export function GoalCard({ goal, error, aiReady, onChange }: GoalCardProps) {
  return (
    <Card title="Ziel des Tests">
      {!aiReady && (
        <Notice tone="warning" title="Noch kein KI-Anbieter eingerichtet">
          Freie Tests brauchen einen KI-Anbieter, der Bilder versteht (Gemini, OpenAI oder Claude).
          Du kannst den Test schon anlegen; seine Durchläufe schlagen fehl, bis einer eingerichtet
          ist.{' '}
          <Link href="/einstellungen/ki" className="font-medium underline">
            Zu den KI-Einstellungen
          </Link>
        </Notice>
      )}
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
        Jeder Durchlauf schickt Seitenaufbau und Bildschirmfotos an deinen KI-Anbieter.
      </p>
    </Card>
  );
}
