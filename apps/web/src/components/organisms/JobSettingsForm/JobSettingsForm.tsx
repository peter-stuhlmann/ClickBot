import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';

export type JobSettingsValues = { name: string; startUrl: string };

export type JobSettingsFormProps = {
  values: JobSettingsValues;
  /** Messages by field: name, startUrl. */
  errors: Record<string, string>;
  onChange: (patch: Partial<JobSettingsValues>) => void;
};

/** Name and start address of an existing job (editor). */
export function JobSettingsForm({ values, errors, onChange }: JobSettingsFormProps) {
  return (
    <Card title="Job">
      <Field id="job-name" label="Job-Name" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        )}
      </Field>
      <Field
        id="job-url"
        label="Website (Start-URL)"
        hint="Relative Adressen in den Schritten beziehen sich auf diese Adresse."
        error={errors.startUrl}
      >
        {(control) => (
          <Input
            {...control}
            inputMode="url"
            value={values.startUrl}
            onChange={(event) => onChange({ startUrl: event.target.value })}
          />
        )}
      </Field>
    </Card>
  );
}
