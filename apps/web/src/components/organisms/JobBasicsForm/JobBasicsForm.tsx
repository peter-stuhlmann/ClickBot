import Link from 'next/link';
import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/molecules/Select';
import { Field } from '@/components/molecules/Field';

export type JobBasicsValues = { campaignId: string; name: string };

export type JobBasicsFormProps = {
  values: JobBasicsValues;
  /** The campaigns of the current project. */
  campaigns: { id: string; name: string }[];
  /** Messages by field: campaignId, name. */
  errors: Record<string, string>;
  onChange: (patch: Partial<JobBasicsValues>) => void;
};

/** Step 1 of the job wizard: the campaign of the current project and the job's name. */
export function JobBasicsForm({ values, campaigns, errors, onChange }: JobBasicsFormProps) {
  return (
    <Card title="Zu welcher Kampagne gehört der Job?">
      <Field
        id="job-campaign"
        label="Kampagne"
        error={errors.campaignId}
        hint={
          <Link href="/kampagnen/neu" className="font-medium text-primary hover:underline">
            Neue Kampagne
          </Link>
        }
      >
        {(control) => (
          <Select
            {...control}
            placeholder="Kampagne wählen"
            options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
            value={values.campaignId}
            onChange={(campaignId) => onChange({ campaignId })}
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
