'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Textarea } from '@/components/atoms/Textarea';
import { Field } from '@/components/molecules/Field';
import type { FormState } from '@/lib/views';

export type CampaignFormProps = {
  /** The current project, in which the campaign is created. */
  projectName: string;
  /** Server action; reads name, startsOn, endsOn and description and redirects on success. */
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

/** "Kampagne anlegen": works without JavaScript, because it is a plain form. */
export function CampaignForm({ projectName, action }: CampaignFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} aria-label="Kampagne anlegen" className="max-w-xl">
      <Card
        title="Neue Kampagne"
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
              <Input {...control} type="date" name="startsOn" defaultValue={values.startsOn} />
            )}
          </Field>
          <Field id="campaign-end" label="Ende (optional)" error={errors.endsOn}>
            {(control) => (
              <Input {...control} type="date" name="endsOn" defaultValue={values.endsOn} />
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
            Kampagne anlegen
          </Button>
        </div>
      </Card>
    </form>
  );
}
