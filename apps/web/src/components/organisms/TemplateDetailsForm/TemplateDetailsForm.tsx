import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Textarea } from '@/components/atoms/Textarea';
import { Field } from '@/components/molecules/Field';

export type TemplateDetailsValues = { name: string; description: string };

export type TemplateDetailsFormProps = {
  values: TemplateDetailsValues;
  /** Messages by field: name, description. */
  errors: Record<string, string>;
  onChange: (patch: Partial<TemplateDetailsValues>) => void;
};

/** Name and note of a template, with how its steps work on any website. */
export function TemplateDetailsForm({ values, errors, onChange }: TemplateDetailsFormProps) {
  return (
    <Card
      title="Vorlage"
      description="Jeder Test öffnet zuerst seine eigene Adresse der Website. Seiten der Website trägst du als Pfad ein, z. B. /kontakt, dann passt die Vorlage auf jede Website."
    >
      <Field id="template-name" label="Name der Vorlage" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        )}
      </Field>
      <Field
        id="template-description"
        label="Beschreibung (optional)"
        hint="Was der Ablauf tut; erscheint bei der Auswahl im Assistenten."
        error={errors.description}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            value={values.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        )}
      </Field>
    </Card>
  );
}
