'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Textarea } from '@/components/atoms/Textarea';
import { Field } from '@/components/molecules/Field';
import type { FormAction } from '@/lib/views';

export type SaveTemplateCardProps = {
  jobId: string;
  /** Suggested name, the job's. */
  defaultName: string;
  /** Saves the stored flow of the job as a template; answers with a notice and its link. */
  action: FormAction;
  /** Why saving is not possible right now, e.g. unsaved changes; the button is disabled then. */
  blocked?: string;
};

/** "Als Vorlage speichern" in the editor: the job's flow becomes a template for other jobs. */
export function SaveTemplateCard({ jobId, defaultName, action, blocked }: SaveTemplateCardProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <Card
      title="Als Vorlage speichern"
      description="Der Ablauf wird zur Vorlage für andere Jobs: ohne das Öffnen der Start-URL und ohne Passwortschutz, Seiten dieser Website als Pfad."
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="jobId" value={jobId} />
        <Field id="save-template-name" label="Name der Vorlage" error={state.fieldErrors?.name}>
          {(control) => (
            <Input {...control} name="name" defaultValue={state.values?.name ?? defaultName} />
          )}
        </Field>
        <Field
          id="save-template-description"
          label="Beschreibung (optional)"
          error={state.fieldErrors?.description}
        >
          {(control) => (
            <Textarea
              {...control}
              name="description"
              rows={2}
              defaultValue={state.values?.description ?? ''}
            />
          )}
        </Field>
        {blocked && <p className="text-meta text-text-muted">{blocked}</p>}
        {state.error && (
          <p role="alert" className="text-body text-danger">
            {state.error}
          </p>
        )}
        {state.notice && (
          <p role="status" className="text-body text-success">
            {state.notice}{' '}
            {state.link && (
              <Link href={state.link} className="font-medium underline">
                Vorlage öffnen
              </Link>
            )}
          </p>
        )}
        <div>
          <Button
            type="submit"
            variant="secondary"
            icon={<Icon name="copy" size={16} />}
            loading={pending}
            disabled={blocked !== undefined}
          >
            Vorlage erstellen
          </Button>
        </div>
      </form>
    </Card>
  );
}
