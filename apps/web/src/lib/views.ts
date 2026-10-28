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
  lastRun: { tone: Tone; label: string; when: string } | null;
  successRate: { text: string; tone: Tone } | null;
  status: { label: string; active: boolean; toggleable: boolean };
};

/** One line of a label/value list, e.g. the summary next to the job wizard. */
export type SummaryRowView = { label: string; value: string };

/** Colour of a step type badge, e.g. "Klicken" in primary, "Prüfen" in success. */
export type StepTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning';

/** One step in the step list of the editor and the job wizard. */
export type StepItemView = { typeLabel: string; tone: StepTone; title: string; detail: string };
