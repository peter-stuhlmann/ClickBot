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
  /** Server action; reads `name` and redirects on success. */
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
};

/** "Kunde anlegen": works without JavaScript, because it is a plain form. */
export function CustomerForm({ action }: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} aria-label="Kunde anlegen" className="max-w-xl">
      <Card
        title="Neuer Kunde"
        description="Jeder Job gehört zu einem Kunden. Das Kürzel für Adressen entsteht aus dem Namen."
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
              defaultValue={state.name}
            />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" href="/kunden">
            Abbrechen
          </Button>
          <Button type="submit" loading={pending} icon={<Icon name="check" size={16} />}>
            Kunde anlegen
          </Button>
        </div>
      </Card>
    </form>
  );
}
