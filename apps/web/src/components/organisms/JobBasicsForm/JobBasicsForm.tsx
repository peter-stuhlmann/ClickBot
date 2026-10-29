import Link from 'next/link';
import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Field } from '@/components/molecules/Field';

export type JobBasicsValues = { customerId: string; name: string };

export type JobBasicsFormProps = {
  values: JobBasicsValues;
  customers: { id: string; name: string }[];
  /** Messages by field: customerId, name. */
  errors: Record<string, string>;
  onChange: (patch: Partial<JobBasicsValues>) => void;
};

/** Step 1 of the job wizard: the project the job belongs to and its name. */
export function JobBasicsForm({ values, customers, errors, onChange }: JobBasicsFormProps) {
  return (
    <Card title="Zu welchem Projekt gehört der Job?">
      <Field
        id="job-customer"
        label="Projekt"
        error={errors.customerId}
        hint={
          customers.length === 0 ? (
            <>
              Noch keine Projekte angelegt.{' '}
              <Link href="/projekte/neu" className="font-medium text-primary hover:underline">
                Projekt anlegen
              </Link>
            </>
          ) : undefined
        }
      >
        {(control) => (
          <Select
            {...control}
            placeholder="Projekt wählen"
            options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
            value={values.customerId}
            onChange={(event) => onChange({ customerId: event.target.value })}
          />
        )}
      </Field>
      <Field
        id="job-name"
        label="Job-Name"
        hint="So heißt der Job in der Liste und im Report."
        error={errors.name}
      >
        {(control) => (
          <Input
            {...control}
            placeholder="z. B. Kontaktformular-Test"
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        )}
      </Field>
    </Card>
  );
}
