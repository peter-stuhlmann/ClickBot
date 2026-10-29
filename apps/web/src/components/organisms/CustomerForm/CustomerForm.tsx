'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';

/** What the server action answers when it did not create the customer. */
export type CustomerFormState = { error?: string; name?: string };

export type CustomerFormProps = {
  /** Server action; reads `name` (and `id` when editing) and redirects on success. */
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  /** The project to rename; omitted for a new one. */
  project?: { id: string; name: string };
};

/** "Projekt anlegen" or renaming a project: works without JavaScript, it is a plain form. */
export function CustomerForm({ action, project }: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      aria-label={project ? 'Projekt bearbeiten' : 'Projekt anlegen'}
      className="max-w-xl"
    >
      {project && <input type="hidden" name="id" value={project.id} />}
      <Card
        title={project ? 'Projekt' : 'Neues Projekt'}
        description="Ein Projekt fasst Kampagnen und ihre Jobs zusammen. Das Kürzel für Adressen entsteht aus dem Namen."
      >
        <Field id="customer-name" label="Name" error={state.error}>
          {(control) => (
            <Input
              {...control}
              name="name"
              required
              maxLength={120}
              autoComplete="organization"
              placeholder="z. B. Müller Shop"
              defaultValue={state.name ?? project?.name}
            />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" href="/kampagnen">
            Abbrechen
          </Button>
          <Button type="submit" loading={pending} icon={<Icon name="check" size={16} />}>
            {project ? 'Speichern' : 'Projekt anlegen'}
          </Button>
        </div>
      </Card>
    </form>
  );
}
