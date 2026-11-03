'use client';

import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';
import type { FormAction, ModelPriceView } from '@/lib/views';

export type ModelPriceFormProps = {
  models: ModelPriceView[];
  /** Only admins get the action; the others see the prices only. */
  action?: FormAction;
};

const shown = (value: string) => (value ? `${value} $` : '–');

function ReadOnlyRow({ model }: { model: ModelPriceView }) {
  return (
    <li className="flex flex-col gap-1 border-b border-divider pb-3 last:border-0 last:pb-0">
      <span className="text-body font-medium text-text">
        {model.providerLabel} · <span className="font-mono">{model.model}</span>
      </span>
      <span className="text-meta text-text-muted">
        {model.priced
          ? `Eingabe ${shown(model.input)} · Ausgabe ${shown(model.output)} · Zwischengespeichert ${model.cached ? shown(model.cached) : 'wie Eingabe'}`
          : 'Kein Preis hinterlegt.'}
      </span>
    </li>
  );
}

function PriceRow({ model, action }: { model: ModelPriceView; action: FormAction }) {
  const [state, formAction, saving] = useActionState(action, {});
  const id = (name: string) => `price-${model.provider}-${model.model}-${name}`;
  const value = (name: 'input' | 'output' | 'cached') => state.values?.[name] ?? model[name];

  return (
    <li className="border-b border-divider pb-4 last:border-0 last:pb-0">
      <form
        action={formAction}
        aria-label={`Preis von ${model.providerLabel} ${model.model}`}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="kind" value={model.provider} />
        <input type="hidden" name="model" value={model.model} />
        <span className="text-body font-medium text-text">
          {model.providerLabel} · <span className="font-mono">{model.model}</span>
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field id={id('input')} label="Eingabe" error={state.fieldErrors?.input}>
            {(control) => (
              <Input {...control} name="input" inputMode="decimal" defaultValue={value('input')} />
            )}
          </Field>
          <Field id={id('output')} label="Ausgabe" error={state.fieldErrors?.output}>
            {(control) => (
              <Input
                {...control}
                name="output"
                inputMode="decimal"
                defaultValue={value('output')}
              />
            )}
          </Field>
          <Field
            id={id('cached')}
            label="Zwischengespeichert"
            hint="Leer: wie Eingabe."
            error={state.fieldErrors?.cached}
          >
            {(control) => (
              <Input
                {...control}
                name="cached"
                inputMode="decimal"
                defaultValue={value('cached')}
              />
            )}
          </Field>
        </div>
        {state.error && <p className="text-small text-danger">{state.error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={saving}>
            Speichern
          </Button>
          {state.notice && !saving && (
            <p role="status" className="text-meta text-success">
              {state.notice}
            </p>
          )}
        </div>
      </form>
    </li>
  );
}

/**
 * "Preise je Modell" in "Einstellungen → KI & API": what a model costs per million tokens, so
 * the coin buttons can show what a test cost. Every model that is set up or that a run has used
 * is listed. All fields empty removes a price.
 */
export function ModelPriceForm({ models, action }: ModelPriceFormProps) {
  return (
    <Card
      title="Preise je Modell"
      description="US-Dollar pro 1 Million Token, wie der Anbieter sie angibt. Daraus rechnet Click-Bot die Kosten eines Tests aus, auch für schon gelaufene Durchläufe."
    >
      {models.length === 0 ? (
        <p className="text-body text-text-muted">
          Noch kein Modell. Richte oben einen Anbieter ein, dann erscheint sein Modell hier.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {models.map((model) =>
            action ? (
              <PriceRow key={`${model.provider}/${model.model}`} model={model} action={action} />
            ) : (
              <ReadOnlyRow key={`${model.provider}/${model.model}`} model={model} />
            ),
          )}
        </ul>
      )}
    </Card>
  );
}
