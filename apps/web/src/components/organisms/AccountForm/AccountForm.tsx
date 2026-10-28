'use client';

import { PASSWORD_MIN } from '@click-bot/shared';
import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';
import type { FormAction } from '@/lib/views';

export type AccountFormProps = {
  action: FormAction;
  submitLabel: string;
  /** Given by an invitation: shown, not editable. */
  fixedEmail?: string;
  /** Sent along, e.g. the invitation token. */
  hidden?: Record<string, string>;
};

const PASSWORD_HINT = `Mindestens ${PASSWORD_MIN} Zeichen mit Ziffer oder Sonderzeichen. Passwörter aus bekannten Datenlecks gehen nicht.`;

/** Name, e-mail and a new password: first registration and accepting an invitation. */
export function AccountForm({ action, submitLabel, fixedEmail, hidden = {} }: AccountFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} aria-label={submitLabel} className="flex flex-col gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.error && (
        <p role="alert" className="rounded-input bg-danger-soft px-3 py-2.5 text-body text-danger">
          {state.error}
        </p>
      )}
      <Field id="account-name" label="Name" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            defaultValue={state.values?.name}
          />
        )}
      </Field>
      {fixedEmail ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-text">E-Mail</span>
          <span className="text-body text-text-muted">{fixedEmail}</span>
          {/* Lets password managers save the account under the right address. */}
          <input type="hidden" name="username" autoComplete="username" value={fixedEmail} />
        </div>
      ) : (
        <Field id="account-email" label="E-Mail" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue={state.values?.email}
            />
          )}
        </Field>
      )}
      <Field id="account-password" label="Passwort" hint={PASSWORD_HINT} error={errors.password}>
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
          />
        )}
      </Field>
      <Button type="submit" fullWidth loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
