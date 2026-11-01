'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StepItem } from '@/components/molecules/StepItem';
import { cn } from '@/lib/cn';
import type { TemplateView } from '@/lib/views';

export type TemplatePickerProps = {
  templates: TemplateView[];
  /** Takes over the steps of the chosen template. */
  onApply: (templateId: string) => void;
};

/** "Aus Vorlage" in the wizard: choose a template, look at its steps, take them over. */
export function TemplatePicker({ templates, onApply }: TemplatePickerProps) {
  const [chosenId, setChosenId] = useState(templates[0]?.id ?? null);
  const chosen = templates.find((template) => template.id === chosenId);

  if (templates.length === 0) {
    return (
      <Card title="Vorlage wählen">
        <p className="text-body text-text-muted">
          Es gibt noch keine Vorlagen. Lege sie unter „Vorlagen“ an oder speichere im Editor eines
          Tests seinen Ablauf als Vorlage.
        </p>
        <div>
          <Button variant="secondary" href="/vorlagen">
            Zu den Vorlagen
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Vorlage wählen"
      description="Die Schritte kommen in diesen Test; ändern kannst du sie danach hier. Die Vorlage selbst bleibt, wie sie ist."
    >
      <ul aria-label="Vorlagen" className="flex flex-col gap-2">
        {templates.map((template) => {
          const selected = template.id === chosenId;
          return (
            <li key={template.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => setChosenId(template.id)}
                className={cn(
                  'flex w-full flex-col items-start gap-1 rounded-input px-4 py-3 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  selected
                    ? 'border-2 border-primary bg-primary-soft'
                    : 'border border-border bg-surface hover:border-border-strong',
                )}
              >
                <span className="flex items-center gap-1.5 text-body font-medium text-text">
                  {selected && <Icon name="check" size={16} className="text-primary" />}
                  {template.name}
                </span>
                {/* Darker on the tinted card, so the text keeps its contrast there too. */}
                {template.description && (
                  <span
                    className={cn(
                      'text-meta',
                      selected ? 'text-text-secondary' : 'text-text-muted',
                    )}
                  >
                    {template.description}
                  </span>
                )}
                <span
                  className={cn('text-small', selected ? 'text-text-secondary' : 'text-text-muted')}
                >
                  {template.meta}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {chosen && (
        <>
          <ol aria-label={`Schritte von ${chosen.name}`} className="flex flex-col gap-2">
            {chosen.steps.map((step, index) => (
              <li key={index}>
                <StepItem index={index} step={step} selected={false} readOnly />
              </li>
            ))}
          </ol>
          <div>
            <Button icon={<Icon name="check" size={16} />} onClick={() => onApply(chosen.id)}>
              Schritte übernehmen
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
