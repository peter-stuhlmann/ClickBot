'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Textarea } from '@/components/atoms/Textarea';
import { DatePicker } from '@/components/molecules/DatePicker';
import { Field } from '@/components/molecules/Field';
import type { FormState } from '@/lib/views';

export type CampaignFormProps = {
  /** The current project, in which the campaign is created. */
  projectName: string;
  /** Server action; reads name, startsOn, endsOn, description (and id) and redirects on success. */
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** The campaign to change; omitted for a new one. */
  campaign?: {
    id: string;
    name: string;
    startsOn: string | null;
    endsOn: string | null;
    description: string | null;
  };
};

/** "Kampagne anlegen" or changing one: works without JavaScript, it is a plain form. */
export function CampaignForm({ projectName, action, campaign }: CampaignFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  // What was typed wins over what is stored, so a rejected change is not lost.
  const values = state.values ?? {
    name: campaign?.name ?? '',
    startsOn: campaign?.startsOn ?? '',
    endsOn: campaign?.endsOn ?? '',
    description: campaign?.description ?? '',
  };
  return (
    <form
      action={formAction}
      aria-label={campaign ? 'Kampagne bearbeiten' : 'Kampagne anlegen'}
      className="max-w-xl"
    >
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <Card
        title={campaign ? 'Kampagne' : 'Neue Kampagne'}
        description={`Im Projekt „${projectName}“. Eine Kampagne fasst Jobs zusammen, z. B. für eine Aktion oder eine Landingpage.`}
      >
        {state.error && <p className="text-small text-danger">{state.error}</p>}
        <Field id="campaign-name" label="Name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              name="name"
              required
              maxLength={120}
              placeholder="z. B. Black Friday"
              defaultValue={values.name}
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="campaign-start" label="Start (optional)" error={errors.startsOn}>
            {(control) => (
              <DatePicker
                {...control}
                label="Start"
                name="startsOn"
                defaultValue={values.startsOn}
              />
            )}
          </Field>
          <Field id="campaign-end" label="Ende (optional)" error={errors.endsOn}>
            {(control) => (
              <DatePicker {...control} label="Ende" name="endsOn" defaultValue={values.endsOn} />
            )}
          </Field>
        </div>
        <Field id="campaign-note" label="Notiz (optional)" error={errors.description}>
          {(control) => (
            <Textarea
              {...control}
              name="description"
              rows={3}
              maxLength={2000}
              placeholder="Worum geht es in der Kampagne?"
              defaultValue={values.description}
            />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" href="/kampagnen">
            Abbrechen
          </Button>
          <Button type="submit" loading={pending} icon={<Icon name="check" size={16} />}>
            {campaign ? 'Speichern' : 'Kampagne anlegen'}
          </Button>
        </div>
      </Card>
    </form>
  );
}
