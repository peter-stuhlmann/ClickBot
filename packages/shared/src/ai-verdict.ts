/**
 * The verdict of an AI step: the goal of the test split into sub-goals, each judged by the AI
 * with what it saw. All met: the step passes; one failed: it fails; else it is unclear.
 */
export type CriterionStatus = 'met' | 'failed' | 'unknown';

/** One sub-goal with the verdict of the AI and what it saw. German. */
export type Criterion = { goal: string; status: CriterionStatus; evidence: string };

export type VerdictOutcome = 'passed' | 'failed' | 'unclear';

/** How the step ends: failed beats unknown, unknown beats met. */
export function verdictOutcome(criteria: readonly Criterion[]): VerdictOutcome {
  if (criteria.some((criterion) => criterion.status === 'failed')) return 'failed';
  if (criteria.some((criterion) => criterion.status === 'unknown')) return 'unclear';
  return 'passed';
}
