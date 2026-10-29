import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Textarea } from '@/components/atoms/Textarea';
import { Field } from '@/components/molecules/Field';
import { KeyValueRow } from '@/components/molecules/KeyValueRow';
import { Notice } from '@/components/molecules/Notice';
import { StepItem } from '@/components/molecules/StepItem';
import { cn } from '@/lib/cn';
import type { FlowQuestionView, StepItemView, SummaryRowView } from '@/lib/views';

export type AiFlowPanelProps = {
  description: string;
  onDescriptionChange: (description: string) => void;
  /** Sends description and answers to the AI. */
  onGenerate: () => void;
  generating: boolean;
  error?: string;
  suggestion?: {
    steps: StepItemView[];
    questions: FlowQuestionView[];
    facts: SummaryRowView[];
    notice: string | null;
  };
  /** Chosen answer per question. */
  answers: Record<string, string>;
  onAnswer: (question: string, answer: string) => void;
  /** Replaces the flow with the suggested steps. */
  onAccept: () => void;
};

const PLACEHOLDER =
  'z. B. Öffne die Kontaktseite, akzeptiere das Cookie-Banner, fülle das Formular mit Testdaten aus, sende es ab und prüfe, ob „Vielen Dank“ erscheint.';

const HINT =
  'Click-Bot öffnet die Seite dafür einmal (als Bot markiert) und schickt ihren Aufbau an deinen KI-Anbieter. Nichts läuft, bevor du die Schritte übernimmst.';

/** "Mit KI beschreiben" (screen 06): description, suggested steps, questions and page facts. */
export function AiFlowPanel({
  description,
  onDescriptionChange,
  onGenerate,
  generating,
  error,
  suggestion,
  answers,
  onAnswer,
  onAccept,
}: AiFlowPanelProps) {
  const count = suggestion?.steps.length ?? 0;
  return (
    <>
      <Card title="Deine Beschreibung">
        <Field id="ai-description" label="Was soll der Bot tun?" hint={HINT} error={error}>
          {(control) => (
            <Textarea
              {...control}
              rows={5}
              placeholder={PLACEHOLDER}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={suggestion ? 'secondary' : 'primary'}
            icon={<Icon name="sparkles" size={16} />}
            loading={generating}
            onClick={onGenerate}
          >
            {suggestion ? 'Neu erzeugen' : 'Vorschlag erzeugen'}
          </Button>
          {generating && (
            <p role="status" className="text-small text-text-muted">
              Die Seite wird geöffnet und die KI schreibt die Schritte – das kann bis zu einer
              Minute dauern.
            </p>
          )}
        </div>
      </Card>

      {suggestion?.notice && (
        <Notice tone="warning" title="Seite nicht gelesen">
          {suggestion.notice}
        </Notice>
      )}

      {suggestion && suggestion.questions.length > 0 && (
        <Card
          title="Rückfragen der KI"
          description="Deine Antworten fließen in „Neu erzeugen“ ein."
        >
          <ul className="flex flex-col gap-3">
            {suggestion.questions.map((question) => (
              <li
                key={question.question}
                className="flex flex-col gap-2 rounded-input bg-subtle p-3"
              >
                <p className="text-body text-text">{question.question}</p>
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const chosen = answers[question.question] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => onAnswer(question.question, option)}
                        className={cn(
                          'rounded-chip border px-2.5 py-1 text-meta transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                          chosen
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-border bg-surface text-text hover:bg-neutral-soft',
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {suggestion && (
        <Card
          title="Vorschlag der KI"
          aside={
            <span className="shrink-0 text-meta text-text-muted">
              {count === 1 ? '1 Schritt' : `${count} Schritte`}
            </span>
          }
        >
          <ol className="flex flex-col gap-2">
            {suggestion.steps.map((step, index) => (
              <li key={`${index}-${step.title}`}>
                <StepItem index={index} step={step} selected={false} readOnly />
              </li>
            ))}
          </ol>
          <Button icon={<Icon name="check" size={16} />} onClick={onAccept}>
            {count === 1 ? '1 Schritt übernehmen' : `${count} Schritte übernehmen`}
          </Button>
          <p className="text-small text-text-muted">
            Danach kannst du jeden Schritt einzeln ändern. Der bisherige Ablauf wird ersetzt.
          </p>
        </Card>
      )}

      {suggestion && suggestion.facts.length > 0 && (
        <Card title="Auf der Seite erkannt">
          <dl className="flex flex-col gap-2">
            {suggestion.facts.map((fact) => (
              <KeyValueRow key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
