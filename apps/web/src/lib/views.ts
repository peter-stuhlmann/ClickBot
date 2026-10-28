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
