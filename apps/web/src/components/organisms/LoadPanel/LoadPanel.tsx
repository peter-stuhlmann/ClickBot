'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import type { FormAction, LoadSuggestionView, LoadView } from '@/lib/views';

export type LoadPanelProps = LoadView & {
  /** Server action that moves the date of a suggestion; answers with the reason if it cannot. */
  moveAction: FormAction;
};

function Suggestion({
  title,
  text,
  fields,
  moveAction,
}: LoadSuggestionView & Pick<LoadPanelProps, 'moveAction'>) {
  const [state, formAction, pending] = useActionState(moveAction, {});
  return (
    <form
      action={formAction}
      aria-label={title}
      className="flex flex-col gap-3 rounded-input bg-primary-soft p-3 sm:flex-row sm:items-center"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-body font-medium text-text">{title}</p>
        <p className="text-small text-text-muted">{text}</p>
        {state.error && (
          <p role="alert" className="text-small text-danger">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" loading={pending} className="self-start sm:self-center">
        Übernehmen
      </Button>
    </form>
  );
}

/**
 * "Auslastung" below the calendar: when more runs would run than the worker has browsers, and a
 * date that could move so that every run gets one.
 */
export function LoadPanel({ title, overloads, summary, note, moveAction }: LoadPanelProps) {
  return (
    <Card title={title}>
      {summary && <p className="text-body text-text">{summary}</p>}
      {overloads.map((overload) => (
        <div key={overload.key} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 rounded-input bg-warning-soft p-3">
            <p className="text-body font-medium text-text">{overload.title}</p>
            <p className="text-small text-text-muted">{overload.text}</p>
          </div>
          {overload.suggestion && <Suggestion {...overload.suggestion} moveAction={moveAction} />}
        </div>
      ))}
      <p className="text-small text-text-muted">{note}</p>
    </Card>
  );
}
