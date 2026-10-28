'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';
import type { FormAction } from '@/lib/views';

export type CodeFormProps = {
  action: FormAction;
  submitLabel?: string;
};

/** The 6-digit code from the authenticator app, at login and when setting up 2FA. */
export function CodeForm({ action, submitLabel = 'Bestätigen' }: CodeFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} aria-label="2FA-Code" className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-input bg-danger-soft px-3 py-2.5 text-body text-danger">
          {state.error}{' '}
          {state.restart && (
            <a href="/anmelden" className="font-medium underline">
              Zur Anmeldung
            </a>
          )}
        </p>
      )}
      <Field id="totp-code" label="Code aus der Authenticator-App">
        {(control) => (
          <Input
            {...control}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            mono
            disabled={state.restart}
          />
        )}
      </Field>
      <Button type="submit" fullWidth loading={pending} disabled={state.restart}>
        {submitLabel}
      </Button>
    </form>
  );
}
