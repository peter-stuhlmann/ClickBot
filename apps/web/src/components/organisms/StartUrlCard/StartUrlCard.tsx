import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';

export type StartUrlCardProps = {
  value: string;
  error?: string;
  onChange: (startUrl: string) => void;
};

/** Step 2 of the job wizard: the address the bot opens first, for every way to the flow. */
export function StartUrlCard({ value, error, onChange }: StartUrlCardProps) {
  return (
    <Card
      title="Wo beginnt der Test?"
      description="Hier beginnt jeder Durchlauf. Getestet werden nur eigene Websites und Kundenseiten mit Freigabe."
    >
      <Field
        id="job-url"
        label="Adresse der Website"
        hint="z. B. https://beispiel.de/kontakt – ohne https:// wird es ergänzt."
        error={error}
      >
        {(control) => (
          <Input
            {...control}
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </Field>
    </Card>
  );
}
