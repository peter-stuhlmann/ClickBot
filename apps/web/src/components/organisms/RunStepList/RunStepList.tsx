import { Card } from '@/components/atoms/Card';
import { RunStepItem } from '@/components/molecules/RunStepItem';
import type { RunStepView } from '@/lib/views';

export type RunStepListProps = {
  steps: RunStepView[];
  /** "6 Schritte · 8,4 s" */
  summary: string;
};

/** The flow of one run, step by step with its result. */
export function RunStepList({ steps, summary }: RunStepListProps) {
  return (
    <Card
      title="Ablauf"
      aside={<span className="shrink-0 text-meta text-text-muted">{summary}</span>}
    >
      <ol className="flex flex-col divide-y divide-divider">
        {steps.map((step) => (
          <li key={step.number}>
            <RunStepItem {...step} />
          </li>
        ))}
      </ol>
    </Card>
  );
}
