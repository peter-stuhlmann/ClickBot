import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StepItem } from '@/components/molecules/StepItem';
import type { TemplateView } from '@/lib/views';

export type TemplateListProps = { templates: TemplateView[] };

/** How many steps a card shows before "… und N weitere". */
const PREVIEW = 4;

/** The templates as cards, each with its first steps; without any, how to make one. */
export function TemplateList({ templates }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <Card title="Noch keine Vorlagen">
        <p className="text-body text-text-muted">
          Eine Vorlage ist ein Ablauf für jede Website, z. B. „Kontaktformular absenden“. Lege sie
          hier an oder speichere im Editor eines Tests seinen Ablauf als Vorlage. Im Assistenten
          „Neuer Test“ übernimmst du sie mit „Aus Vorlage“.
        </p>
        <div>
          <Button href="/vorlagen/neu" icon={<Icon name="plus" size={16} />}>
            Neue Vorlage
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <ul aria-label="Vorlagen" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {templates.map((template) => (
        <li
          key={template.id}
          className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-card font-semibold text-text">
              <Link
                href={template.href}
                className="rounded-chip hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {template.name}
              </Link>
            </h2>
            {template.description && (
              <p className="text-body text-text-muted">{template.description}</p>
            )}
            <p className="text-small text-text-muted">{template.meta}</p>
          </div>
          <ol aria-label={`Schritte von ${template.name}`} className="flex flex-col gap-2">
            {template.steps.slice(0, PREVIEW).map((step, index) => (
              <li key={index}>
                <StepItem index={index} step={step} selected={false} readOnly />
              </li>
            ))}
          </ol>
          {template.steps.length > PREVIEW && (
            <p className="text-small text-text-muted">
              … und {template.steps.length - PREVIEW} weitere
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
