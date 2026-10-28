import { Card } from '@/components/atoms/Card';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Field } from '@/components/molecules/Field';

export type WebsiteValues = {
  customerId: string;
  startUrl: string;
  name: string;
  confirmed: boolean;
};

export type WebsiteFormProps = {
  values: WebsiteValues;
  customers: { id: string; name: string }[];
  /** Messages by field: customerId, startUrl, name, confirmed. */
  errors: Record<string, string>;
  onChange: (patch: Partial<WebsiteValues>) => void;
};

/** Step 1 of the job wizard: whose website, where the bot starts and what the job is called. */
export function WebsiteForm({ values, customers, errors, onChange }: WebsiteFormProps) {
  return (
    <Card
      title="Welche Website soll getestet werden?"
      description="Der Bot startet auf dieser Adresse. Click-Bot testet nur eigene Websites und Kundenseiten mit Freigabe."
    >
      <Field
        id="job-customer"
        label="Kunde"
        error={errors.customerId}
        hint={customers.length === 0 ? 'Noch keine Kunden angelegt.' : undefined}
      >
        {(control) => (
          <Select
            {...control}
            placeholder="Kunde wählen"
            options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
            value={values.customerId}
            onChange={(event) => onChange({ customerId: event.target.value })}
          />
        )}
      </Field>
      <Field
        id="job-url"
        label="Website (Start-URL)"
        hint="z. B. https://beispiel.de/kontakt – ohne https:// wird es ergänzt."
        error={errors.startUrl}
      >
        {(control) => (
          <Input
            {...control}
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            value={values.startUrl}
            onChange={(event) => onChange({ startUrl: event.target.value })}
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
      <div className="flex flex-col gap-1.5">
        <Checkbox
          label="Die Website gehört uns oder dem Kunden, und der Kunde hat den Test freigegeben."
          checked={values.confirmed}
          onChange={(event) => onChange({ confirmed: event.target.checked })}
          {...(errors.confirmed
            ? { 'aria-invalid': true, 'aria-describedby': 'job-confirmed-error' }
            : {})}
        />
        {errors.confirmed && (
          <p id="job-confirmed-error" className="text-small text-danger">
            {errors.confirmed}
          </p>
        )}
      </div>
    </Card>
  );
}
