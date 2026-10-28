'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Field } from '@/components/molecules/Field';
import type { FormAction } from '@/lib/views';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Mitglied' },
  { value: 'admin', label: 'Admin (verwaltet das Team)' },
];

export type InviteFormProps = { action: FormAction };

/**
 * Creates an invitation link. There is no e-mail sending yet, so the link is shown once to be
 * passed on. For an address with an account, the link resets its password and 2FA.
 */
export function InviteForm({ action }: InviteFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <Card
      title="Person einladen"
      description="Der Link gilt 7 Tage und nur einmal. Für eine Adresse mit Konto setzt er Passwort und 2FA neu."
    >
      <form action={formAction} aria-label="Person einladen" className="flex flex-col gap-4">
        <Field id="invite-email" label="E-Mail" error={state.fieldErrors?.email}>
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              required
              defaultValue={state.link ? '' : state.values?.email}
            />
          )}
        </Field>
        <Field id="invite-role" label="Rolle" error={state.fieldErrors?.role}>
          {(control) => (
            <Select {...control} name="role" options={ROLE_OPTIONS} defaultValue="member" />
          )}
        </Field>
        <Button type="submit" loading={pending}>
          Einladungslink erstellen
        </Button>
      </form>
      {state.link && (
        <div role="status" className="flex flex-col gap-2 rounded-input bg-success-soft p-3">
          <p className="text-body text-success">
            Link erstellt. Er ist nur jetzt sichtbar – bitte kopieren und weitergeben.
          </p>
          <Input aria-label="Einladungslink" readOnly mono value={state.link} />
        </div>
      )}
    </Card>
  );
}
