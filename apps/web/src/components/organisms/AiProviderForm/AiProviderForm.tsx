'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';
import { KeyValueRow } from '@/components/molecules/KeyValueRow';
import { cn } from '@/lib/cn';
import type {
  AiProviderView,
  ConnectionCheck,
  ConnectionCheckAction,
  FormAction,
} from '@/lib/views';

export type AiProviderActions = {
  save: FormAction;
  test: ConnectionCheckAction;
  makeDefault: (formData: FormData) => Promise<void>;
  remove: (formData: FormData) => Promise<void>;
};

export type AiProviderFormProps = {
  provider: AiProviderView;
  /** Only admins get actions; without them the card shows the state only. */
  actions?: AiProviderActions;
};

const CHECK_TONE: Record<ConnectionCheck['tone'], string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

function status(provider: AiProviderView) {
  if (provider.isDefault) return <Badge tone="success">Standard</Badge>;
  return (
    <Badge tone="neutral">{provider.configured ? 'Eingerichtet' : 'Nicht eingerichtet'}</Badge>
  );
}

/**
 * One AI provider in "Einstellungen → KI & API": key, model and, for a custom endpoint, its
 * address. The stored key never comes back to the browser; an empty key field keeps it.
 */
export function AiProviderForm({ provider, actions }: AiProviderFormProps) {
  if (!actions) {
    return (
      <Card title={provider.label} aside={status(provider)}>
        {provider.configured ? (
          <dl className="flex flex-col gap-2">
            <KeyValueRow label="Modell" value={provider.model} />
            {provider.needsBaseUrl && <KeyValueRow label="Adresse" value={provider.baseUrl} />}
            <KeyValueRow label="API-Schlüssel" value={provider.keyHint ?? 'keiner'} />
          </dl>
        ) : (
          <p className="text-body text-text-muted">Einrichten können nur Admins.</p>
        )}
      </Card>
    );
  }
  return <EditableProvider provider={provider} actions={actions} />;
}

function EditableProvider({
  provider,
  actions,
}: {
  provider: AiProviderView;
  actions: AiProviderActions;
}) {
  const [state, formAction, saving] = useActionState(actions.save, {});
  const [check, setCheck] = useState<ConnectionCheck | null>(null);
  const [testing, startTest] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const id = (field: string) => `ai-${provider.kind}-${field}`;
  const models = check?.models ?? provider.modelSuggestions;

  function testConnection() {
    if (!form.current) return;
    const data = new FormData(form.current);
    startTest(async () => setCheck(await actions.test(data)));
  }

  return (
    <Card title={provider.label} description={provider.keyHelp} aside={status(provider)}>
      <form
        ref={form}
        action={formAction}
        aria-label={`${provider.label} einrichten`}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="kind" value={provider.kind} />
        {provider.needsBaseUrl && (
          <Field
            id={id('base-url')}
            label="Adresse der API"
            hint="OpenAI-kompatibel, z. B. http://localhost:11434/v1 für Ollama."
            error={state.fieldErrors?.baseUrl}
          >
            {(control) => (
              <Input
                {...control}
                name="baseUrl"
                mono
                defaultValue={state.values?.baseUrl ?? provider.baseUrl}
              />
            )}
          </Field>
        )}
        <Field
          id={id('key')}
          label={provider.keyRequired ? 'API-Schlüssel' : 'API-Schlüssel (optional)'}
          hint="Wird verschlüsselt gespeichert und nie wieder angezeigt."
          error={state.fieldErrors?.apiKey}
        >
          {(control) => (
            <Input
              {...control}
              name="apiKey"
              type="password"
              autoComplete="off"
              mono
              placeholder={
                provider.keyHint
                  ? `Gespeichert (${provider.keyHint}) – leer lassen, um ihn zu behalten`
                  : undefined
              }
            />
          )}
        </Field>
        <Field
          id={id('model')}
          label="Modell"
          hint="„Verbindung testen“ lädt die Modelle des Anbieters in die Auswahl."
          error={state.fieldErrors?.model}
        >
          {(control) => (
            <>
              <Input
                {...control}
                name="model"
                mono
                list={id('models')}
                defaultValue={state.values?.model ?? provider.model}
              />
              <datalist id={id('models')}>
                {models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        {state.error && <p className="text-small text-danger">{state.error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving}>
            Speichern
          </Button>
          <Button variant="secondary" loading={testing} onClick={testConnection}>
            Verbindung testen
          </Button>
          {state.notice && !saving && (
            <p role="status" className="text-meta text-success">
              {state.notice}
            </p>
          )}
        </div>
      </form>
      {check && !testing && (
        <p role="status" className={cn('rounded-input p-3 text-body', CHECK_TONE[check.tone])}>
          {check.message}
        </p>
      )}
      {provider.configured && (
        <div className="flex gap-2 border-t border-border pt-4">
          {!provider.isDefault && (
            <form action={actions.makeDefault}>
              <input type="hidden" name="kind" value={provider.kind} />
              <Button type="submit" variant="ghost" size="sm">
                Als Standard verwenden
              </Button>
            </form>
          )}
          <form action={actions.remove}>
            <input type="hidden" name="kind" value={provider.kind} />
            <Button type="submit" variant="ghost" size="sm">
              {provider.label} entfernen
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
