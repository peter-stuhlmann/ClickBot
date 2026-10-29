/**
 * Display data for components. Pages build these from database rows (see src/server), so
 * components never depend on the database shape.
 */

import type { StepDraft } from './job-draft';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

export type StatCardView = {
  label: string;
  value: string;
  hint: string;
};

export type JobRowView = {
  id: string;
  name: string;
  /** Name of the campaign the job belongs to. */
  campaign: string;
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
  /** Set when the run marked its GA4 requests only partly or not at all. */
  marking: { title: string; message: string } | null;
};

/** Title line of the editor: name, status badge, schedule and devices. */
export type JobHeaderView = {
  title: string;
  status: { tone: Tone; label: string };
  description: string;
};

/** One row of the campaign table. */
export type CampaignRowView = {
  id: string;
  name: string;
  /** "20.11.–30.11.2026 · beispiel.de · 3 Websites" */
  detail: string;
  jobs: { primary: string; secondary: string };
  /** Runs of the last 30 days; `value` is the share of successful ones, 0–1. */
  runs: { label: string; value: number };
  lastRun: JobRowView['lastRun'];
  successRate: { text: string; tone: Tone } | null;
};

/** One run in the list of all runs (screen 14). */
export type RunListRowView = {
  id: string;
  href: string;
  jobName: string;
  /** "Lauf #7 · iPhone 15 · Bot 2": the second line, never cut off. */
  detail: string;
  /** Started from the editor, outside the schedule. */
  testRun: boolean;
  /** Campaign of the job. */
  campaign: string;
  /** "05.11. 14:30", start or planned start. */
  when: string;
  duration: string;
  status: { tone: Tone; label: string };
  failed: boolean;
};

/** Answer of a server action to a form (login, registration, invitation). */
export type FormState = {
  /** About the form as a whole. */
  error?: string;
  /** By field name. */
  fieldErrors?: Partial<Record<string, string>>;
  /** What was typed, so the form keeps it (never passwords). */
  values?: Record<string, string>;
  /** The login has to start over, e.g. after too many wrong codes. */
  restart?: boolean;
  /** A created invitation link, shown once. */
  link?: string;
  /** Short confirmation, e.g. „Gespeichert.“ */
  notice?: string;
};

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** One account in "Einstellungen → Team". */
export type TeamMemberView = {
  id: string;
  name: string;
  email: string;
  role: string;
  twoFactor: boolean;
};

/** An invitation link that can still be used. */
export type InvitationView = { id: string; email: string; role: string; expires: string };

/** One provider in "Einstellungen → KI & API". Never carries the key, only its hint. */
export type AiProviderView = {
  kind: string;
  label: string;
  /** Where to get a key. */
  keyHelp: string;
  configured: boolean;
  isDefault: boolean;
  model: string;
  /** Only the custom endpoint has an address field. */
  needsBaseUrl: boolean;
  baseUrl: string;
  keyRequired: boolean;
  /** "…1234" of the stored key, null without one. */
  keyHint: string | null;
  /** Offered in the model field before a connection test lists the real models. */
  modelSuggestions: string[];
};

/** Result of "Verbindung testen". */
export type ConnectionCheck = {
  tone: 'success' | 'warning' | 'danger';
  message: string;
  /** The provider's models, for the model field. */
  models?: string[];
};

export type ConnectionCheckAction = (formData: FormData) => Promise<ConnectionCheck>;

/** A question of the model with answers to choose from ("Rückfragen der KI"). */
export type FlowQuestionView = { question: string; options: string[] };

/** "Mit KI beschreiben": the suggested steps, or why there is none. */
export type FlowSuggestionResult =
  | {
      ok: true;
      steps: StepDraft[];
      questions: FlowQuestionView[];
      /** "Auf der Seite erkannt"; empty when the page could not be opened. */
      facts: SummaryRowView[];
      /** Why the model did not know the page, if so. */
      notice: string | null;
    }
  | { ok: false; message: string };

export type SuggestFlowAction = (input: {
  startUrl: string;
  description: string;
  answers: { question: string; answer: string }[];
}) => Promise<FlowSuggestionResult>;

/** "Im Browser aufnehmen": record turns actions into steps, browse only uses the page, assert checks the next element clicked. */
export type LiveMode = 'record' | 'browse' | 'assert';

/** Input for the live browser on the worker (see parseClientMessage in the worker). */
export type LiveInput =
  | { type: 'click'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'wheel'; dx: number; dy: number }
  | { type: 'key'; key: string }
  | { type: 'text'; text: string }
  | { type: 'navigate'; url: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'mode'; mode: LiveMode };

export type StartRecordingAction = (
  startUrl: string,
) => Promise<{ ok: true; url: string } | { ok: false; message: string }>;
