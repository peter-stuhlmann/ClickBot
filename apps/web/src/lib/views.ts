/**
 * Display data for components. Pages build these from database rows (see src/server), so
 * components never depend on the database shape.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

export type StatCardView = {
  label: string;
  value: string;
  hint: string;
};

export type JobRowView = {
  id: string;
  name: string;
  url: string;
  schedule: { primary: string; secondary: string };
  progress: { label: string; value: number };
  /** href leads to the report of that run. */
  lastRun: { tone: Tone; label: string; when: string; href: string } | null;
  successRate: { text: string; tone: Tone } | null;
  status: { label: string; active: boolean; toggleable: boolean };
};

/** One line of a label/value list, e.g. the summary next to the job wizard. */
export type SummaryRowView = { label: string; value: string };

/** Colour of a step type badge, e.g. "Klicken" in primary, "Prüfen" in success. */
export type StepTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning';

/** One step in the step list of the editor and the job wizard. */
export type StepItemView = { typeLabel: string; tone: StepTone; title: string; detail: string };

export type RunStepStatus = 'passed' | 'healed' | 'failed' | 'skipped' | 'pending';

/** One step in the run report: what it did and how it went. */
export type RunStepView = {
  number: number;
  status: RunStepStatus;
  title: string;
  /** Error message of a failed step, otherwise the locator in code style. */
  detail: string;
  duration: string;
  screenshotUrl: string | null;
};

/** Screen 03 "Lauf-Report". */
export type RunReportView = {
  jobName: string;
  /** The editor of the job. */
  jobHref: string;
  /** "Lauf #7", for the breadcrumb. */
  runLabel: string;
  /** "Lauf #7 von 20" */
  title: string;
  status: { tone: Tone; label: string };
  /** "Do., 05.11.2026 · 14:30:12 Uhr · ausgelöst durch Zeitplan" */
  meta: string;
  stats: StatCardView[];
  /** "6 Schritte · 8,4 s" */
  stepsSummary: string;
  steps: RunStepView[];
  failure: { title: string; message: string } | null;
  screenshot: { url: string; caption: string } | null;
  /** While the run waits or runs: what it is waiting for. The page then refreshes itself. */
  live: string | null;
};

/** Title line of the editor: name, status badge, schedule and devices. */
export type JobHeaderView = {
  title: string;
  status: { tone: Tone; label: string };
  description: string;
};
