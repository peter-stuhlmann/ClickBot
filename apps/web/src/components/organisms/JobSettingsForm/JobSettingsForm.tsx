import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/molecules/Select';
import { Field } from '@/components/molecules/Field';

export type JobSettingsValues = { name: string; startUrl: string; campaignId: string };

export type JobSettingsFormProps = {
  values: JobSettingsValues;
  /** The campaigns of the job's project; the job can move between them. */
  campaigns: { id: string; name: string }[];
  /** Messages by field: name, startUrl, campaignId. */
  errors: Record<string, string>;
  onChange: (patch: Partial<JobSettingsValues>) => void;
};

/** Name, campaign and start address of an existing job (editor). */
export function JobSettingsForm({ values, campaigns, errors, onChange }: JobSettingsFormProps) {
  return (
    <Card title="Test">
      <Field id="job-name" label="Name des Tests" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        )}
      </Field>
      <Field id="job-campaign" label="Kampagne" error={errors.campaignId}>
        {(control) => (
          <Select
            {...control}
            options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
            value={values.campaignId}
            onChange={(campaignId) => onChange({ campaignId })}
          />
        )}
      </Field>
      <Field
        id="job-url"
        label="Adresse der Website"
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
