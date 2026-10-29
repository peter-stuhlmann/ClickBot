'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import type { FormState } from '@/lib/views';

export type DeleteSectionProps = {
  title: string;
  description: string;
  buttonLabel: string;
  /** Hidden form fields, e.g. the id of what is deleted. */
  fields: Record<string, string>;
  /** Server action; redirects on success, or answers with the reason it did not delete. */
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Why deleting is not possible right now; the button is disabled then. */
  blocked?: string;
};

/** Deleting something, at the end of its page: first the button, then one confirmation. */
export function DeleteSection({
  title,
  description,
  buttonLabel,
  fields,
  action,
  blocked,
}: DeleteSectionProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <Card title={title} description={description}>
      {blocked && <p className="text-body text-text-muted">{blocked}</p>}
      {state.error && (
        <p role="alert" className="text-body text-danger">
          {state.error}
        </p>
      )}
      {confirming ? (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-input bg-danger-soft p-3 sm:flex-row sm:items-center"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p className="flex-1 text-body text-text">
            Wirklich löschen? Das lässt sich nicht rückgängig machen.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Endgültig löschen
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button
            variant="secondary"
            disabled={blocked !== undefined}
            icon={<Icon name="trash" size={16} />}
            onClick={() => setConfirming(true)}
          >
            {buttonLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}
