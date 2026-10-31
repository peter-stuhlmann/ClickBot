import Link from 'next/link';
import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/molecules/Select';
import { Field } from '@/components/molecules/Field';

export type JobBasicsValues = { campaignId: string; name: string };

export type JobBasicsFormProps = {
  values: JobBasicsValues;
  /** The campaigns of the current project; the choice shows only when there are several. */
  campaigns: { id: string; name: string }[];
  /** Messages by field: campaignId, name. */
  errors: Record<string, string>;
  onChange: (patch: Partial<JobBasicsValues>) => void;
};

/**
 * Last step of the wizard: the name of the test, suggested from website or goal, and the
 * campaign when the project has more than one.
 */
export function JobBasicsForm({ values, campaigns, errors, onChange }: JobBasicsFormProps) {
  return (
    <Card title="Wie soll der Test heißen?">
      <Field
        id="job-name"
        label="Job-Name"
        hint="Vorgeschlagen aus Website und Ziel; du kannst ihn ändern. So heißt der Test in der Liste und im Report."
        error={errors.name}
      >
        {(control) => (
          <Input
            {...control}
            placeholder="z. B. Kontaktformular"
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        )}
      </Field>
      {campaigns.length > 1 && (
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
      )}
    </Card>
  );
}
