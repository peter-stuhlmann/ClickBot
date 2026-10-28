'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';
import type { FormAction } from '@/lib/views';

export type LoginFormProps = { action: FormAction };

/** First step of the login: e-mail and password. */
export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} aria-label="Anmelden" className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-input bg-danger-soft px-3 py-2.5 text-body text-danger">
          {state.error}
        </p>
      )}
      <Field id="login-email" label="E-Mail">
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
      <Field id="login-password" label="Passwort">
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>
      <Button type="submit" fullWidth loading={pending}>
        Anmelden
      </Button>
    </form>
  );
}
