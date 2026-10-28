import { DEFAULT_TIMEZONE, flowSchema, localToUtc, scheduleSchema } from '@click-bot/shared';
import { deviceLabel, type DeviceKey } from './devices';
import { describeSchedule, displayUrl, plural } from './format';
import type { SummaryRowView } from './views';

/**
 * State of the "Neuer Job" wizard. Form fields keep what was typed (numbers as text), so a
 * half-filled form survives; the to* functions turn it into input for createJob, and the
 * schemas from @click-bot/shared decide what is valid, on the client and again on the server.
 */

export const WIZARD_STEPS = [
  { key: 'website', label: 'Website', question: 'Welche Website soll getestet werden?' },
  { key: 'flow', label: 'Ablauf', question: 'Wie soll der Ablauf entstehen?' },
  { key: 'schedule', label: 'Zeitplan', question: 'Wann soll der Bot laufen?' },
  {
    key: 'devices',
    label: 'Standort & Gerät',
    question: 'Von wo und auf welchem Gerät wird getestet?',
  },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]['key'];

export type EditableStepType =
  'open' | 'click' | 'fill' | 'select' | 'assert' | 'wait' | 'screenshot' | 'analytics';
export type TargetBy = 'role' | 'label' | 'text' | 'css' | 'testId';
export type AssertKind = 'textVisible' | 'urlContains' | 'titleContains' | 'elementVisible';
export type WaitKind = 'duration' | 'element' | 'networkIdle';

export type StepDraft = {
  id: string;
  type: EditableStepType;
  /** open */
  url: string;
  /** click, fill, select, assert "elementVisible", wait "element" */
  targetBy: TargetBy;
  targetRole: string;
  /** Accessible name (role), label, text, CSS selector or test id, depending on targetBy. */
  targetValue: string;
  /** fill: value · select: option · assert: text · analytics: event · screenshot: name */
  value: string;
  assertKind: AssertKind;
  waitKind: WaitKind;
  waitSeconds: string;
  fullPage: boolean;
  timeoutSeconds: string;
};

export type SlotDraft = { key: string; date: string; time: string; bots: number };

export type ScheduleDraft = {
  type: 'interval' | 'times';
  everyMinutes: string;
  maxRuns: string;
  startMode: 'now' | 'at';
  startDate: string;
  startTime: string;
  slots: SlotDraft[];
  /** Start the bots of a slot 10 s apart instead of in the same second. */
  stagger: boolean;
};

export type WizardDraft = {
  customerId: string;
  startUrl: string;
  name: string;
  /** The user confirmed that the website is their own or the customer approved the test. */
  confirmed: boolean;
  steps: StepDraft[];
  schedule: ScheduleDraft;
  devices: DeviceKey[];
};

export type Issue = { path: string; message: string };

export type NewJobDraftInput = {
  customerId: string;
  name: string;
  startUrl: string;
  flow: { version: 1; steps: Record<string, unknown>[] };
  schedule: Record<string, unknown>;
  devices: DeviceKey[];
  status: 'active';
};

const HOUR_MS = 3_600_000;
const STAGGER_SECONDS = 10;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: DEFAULT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const berlinTime = new Intl.DateTimeFormat('de-DE', {
  timeZone: DEFAULT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function emptyDraft(now: Date): WizardDraft {
  // Berlin is a whole number of hours off UTC, so the next full UTC hour is the next full hour there.
  const nextHour = new Date((Math.floor(now.getTime() / HOUR_MS) + 1) * HOUR_MS);
  const date = berlinDate.format(nextHour);
  const time = berlinTime.format(nextHour);
  return {
    customerId: '',
    startUrl: '',
    name: '',
    confirmed: false,
    steps: [],
    schedule: {
      type: 'interval',
      everyMinutes: '60',
      maxRuns: '24',
      startMode: 'now',
      startDate: date,
      startTime: time,
      slots: [{ key: 'slot-1', date, time, bots: 1 }],
      stagger: true,
    },
    devices: ['desktop'],
  };
}

/** Appends a slot one hour after the last one (same date and time if that is not valid yet). */
export function addSlot(slots: SlotDraft[]): SlotDraft[] {
  const last = slots.at(-1);
  const numbers = slots.map((slot) => Number(/^slot-(\d+)$/.exec(slot.key)?.[1] ?? 0));
  let date = last?.date ?? '';
  let time = last?.time ?? '';
  if (DATE.test(date) && TIME.test(time)) {
    // Wall-clock arithmetic: treat the local time as UTC, so clock changes do not matter here.
    const next = new Date(new Date(`${date}T${time}:00Z`).getTime() + HOUR_MS).toISOString();
    date = next.slice(0, 10);
    time = next.slice(11, 16);
  }
  return [...slots, { key: `slot-${Math.max(0, ...numbers) + 1}`, date, time, bots: 1 }];
}

/** Adds https:// when the scheme is missing: "beispiel.de" → "https://beispiel.de". */
export function normaliseUrl(input: string): string {
  const url = input.trim();
  if (url === '' || /^[a-z][a-z\d+.-]*:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Buttons and links are found by role and name, form fields by their label. */
export function defaultTargetBy(type: EditableStepType): TargetBy {
  return type === 'click' ? 'role' : 'label';
}

/** A new step with an unused id. The first "open" step opens the start URL. */
export function newStep(
  type: EditableStepType,
  existing: StepDraft[],
  startUrl: string,
): StepDraft {
  const numbers = existing
    .map((step) => new RegExp(`^${type}-(\\d+)$`).exec(step.id)?.[1])
    .map(Number)
    .filter(Number.isFinite);
  return {
    id: `${type}-${Math.max(0, ...numbers) + 1}`,
    type,
    url: type === 'open' && existing.length === 0 ? normaliseUrl(startUrl) : '',
    targetBy: defaultTargetBy(type),
    targetRole: 'button',
    targetValue: '',
    value: '',
    assertKind: 'textVisible',
    waitKind: 'duration',
    waitSeconds: '1',
    fullPage: false,
    timeoutSeconds: '10',
  };
}

/** "2,5" → 2.5; empty or garbage → NaN, which the schemas report. */
function toNumber(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

const toMs = (seconds: string) => Math.round(toNumber(seconds) * 1000);

function toTarget(step: StepDraft): Record<string, unknown> {
  const value = step.targetValue.trim();
  switch (step.targetBy) {
    case 'role':
      return value
        ? { by: 'role', role: step.targetRole, name: value }
        : { by: 'role', role: step.targetRole };
    case 'label':
      return { by: 'label', label: value };
    case 'text':
      return { by: 'text', text: value };
    case 'css':
      return { by: 'css', selector: value };
    case 'testId':
      return { by: 'testId', testId: value };
  }
}

function toAssertion(step: StepDraft): Record<string, unknown> {
  const value = step.value.trim();
  switch (step.assertKind) {
    case 'textVisible':
      return { kind: 'textVisible', text: value };
    case 'urlContains':
      return { kind: 'urlContains', value };
    case 'titleContains':
      return { kind: 'titleContains', value };
    case 'elementVisible':
      return { kind: 'elementVisible', target: toTarget(step) };
  }
}

function toWait(step: StepDraft): Record<string, unknown> {
  switch (step.waitKind) {
    case 'duration':
      return { kind: 'duration', ms: toMs(step.waitSeconds) };
    case 'element':
      return { kind: 'element', target: toTarget(step) };
    case 'networkIdle':
      return { kind: 'networkIdle' };
  }
}

function toStep(step: StepDraft): Record<string, unknown> {
  const base = { id: step.id, type: step.type, timeoutMs: toMs(step.timeoutSeconds) };
  switch (step.type) {
    case 'open':
      return { ...base, url: step.url.trim() };
    case 'click':
      return { ...base, target: toTarget(step) };
    case 'fill':
      return { ...base, target: toTarget(step), value: step.value };
    case 'select':
      return { ...base, target: toTarget(step), option: step.value.trim() };
    case 'assert':
      return { ...base, assertion: toAssertion(step) };
    case 'wait':
      return { ...base, until: toWait(step) };
    case 'screenshot': {
      const name = step.value.trim();
      return { ...base, fullPage: step.fullPage, ...(name ? { name } : {}) };
    }
    case 'analytics':
      return { ...base, provider: 'ga4', event: step.value.trim() };
  }
}

function startInstant(schedule: ScheduleDraft, now: Date): Date | null {
  if (schedule.startMode === 'now') return now;
  if (!DATE.test(schedule.startDate) || !TIME.test(schedule.startTime)) return null;
  return localToUtc(schedule.startDate, schedule.startTime, DEFAULT_TIMEZONE);
}

function toSchedule(schedule: ScheduleDraft, now: Date): Record<string, unknown> {
  if (schedule.type === 'interval') {
    return {
      type: 'interval',
      everyMinutes: toNumber(schedule.everyMinutes),
      maxRuns: toNumber(schedule.maxRuns),
      startAt: startInstant(schedule, now)?.toISOString() ?? '',
    };
  }
  return {
    type: 'times',
    slots: schedule.slots.map(({ date, time, bots }) => ({ date, time, bots })),
    staggerSeconds: schedule.stagger ? STAGGER_SECONDS : 0,
    timezone: DEFAULT_TIMEZONE,
  };
}

/** Input for createJob. The job starts as active: saving is the last step of the wizard. */
export function toNewJobInput(draft: WizardDraft, now: Date): NewJobDraftInput {
  return {
    customerId: draft.customerId,
    name: draft.name.trim(),
    startUrl: normaliseUrl(draft.startUrl),
    flow: { version: 1, steps: draft.steps.map(toStep) },
    schedule: toSchedule(draft.schedule, now),
    devices: draft.devices,
    status: 'active',
  };
}

type SchemaError = { issues: { path: PropertyKey[]; message: string }[] };

function issuesFrom(prefix: string, error: SchemaError): Issue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}

function websiteIssues(draft: WizardDraft): Issue[] {
  const issues: Issue[] = [];
  if (!draft.customerId) {
    issues.push({ path: 'customerId', message: 'Bitte einen Kunden wählen.' });
  }
  if (!isHttpUrl(normaliseUrl(draft.startUrl))) {
    issues.push({
      path: 'startUrl',
      message: 'Start-URL muss mit http:// oder https:// beginnen.',
    });
  }
  if (!draft.name.trim()) issues.push({ path: 'name', message: 'Name fehlt.' });
  if (!draft.confirmed) {
    issues.push({
      path: 'confirmed',
      message: 'Bitte bestätigen, dass ihr diese Website testen dürft.',
    });
  }
  return issues;
}

function scheduleIssues(schedule: ScheduleDraft, now: Date): Issue[] {
  const parsed = scheduleSchema.safeParse(toSchedule(schedule, now));
  if (!parsed.success) return issuesFrom('schedule', parsed.error);

  if (schedule.type === 'interval') {
    const start = startInstant(schedule, now);
    return start && start < now
      ? [{ path: 'schedule.startAt', message: 'Der Start liegt in der Vergangenheit.' }]
      : [];
  }
  return schedule.slots.flatMap((slot, index) => {
    const start = localToUtc(slot.date, slot.time, DEFAULT_TIMEZONE);
    return start && start < now
      ? [
          {
            path: `schedule.slots.${index}.time`,
            message: 'Der Termin liegt in der Vergangenheit.',
          },
        ]
      : [];
  });
}

/** Problems that keep the user on `step`. Empty means "Weiter" may continue. */
export function validateWizardStep(draft: WizardDraft, step: WizardStep, now: Date): Issue[] {
  switch (step) {
    case 'website':
      return websiteIssues(draft);
    case 'flow': {
      const parsed = flowSchema.safeParse(toNewJobInput(draft, now).flow);
      return parsed.success ? [] : issuesFrom('flow', parsed.error);
    }
    case 'schedule':
      return scheduleIssues(draft.schedule, now);
    case 'devices':
      return draft.devices.length > 0
        ? []
        : [{ path: 'devices', message: 'Mindestens ein Gerät wählen.' }];
  }
}

/** The wizard step that shows the field at `path`, e.g. after the server rejected the job. */
export function wizardStepOf(path: string): WizardStep {
  const [head] = path.split('.');
  if (head === 'flow' || head === 'schedule' || head === 'devices') return head;
  return 'website';
}

/** First message per path, for fields that show a single error. */
export function errorsByPath(issues: Issue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path] ??= issue.message;
  return errors;
}

export type StepField =
  'url' | 'targetRole' | 'targetValue' | 'value' | 'waitSeconds' | 'timeoutSeconds' | 'general';

const VALUE_PATHS = new Set([
  'value',
  'option',
  'event',
  'name',
  'assertion.text',
  'assertion.value',
]);

function stepField(rest: string): StepField {
  if (rest === 'url') return 'url';
  if (rest === 'timeoutMs') return 'timeoutSeconds';
  if (rest === 'until.ms') return 'waitSeconds';
  if (/(^|\.)target\.role$/.test(rest)) return 'targetRole';
  if (/(^|\.)target(\.|$)/.test(rest)) return 'targetValue';
  if (VALUE_PATHS.has(rest)) return 'value';
  return 'general';
}

/** Messages for the fields of the step form of step `index`. */
export function stepErrors(issues: Issue[], index: number): Partial<Record<StepField, string>> {
  const prefix = `flow.steps.${index}.`;
  const errors: Partial<Record<StepField, string>> = {};
  for (const issue of issues) {
    if (!issue.path.startsWith(prefix)) continue;
    errors[stepField(issue.path.slice(prefix.length))] ??= issue.message;
  }
  return errors;
}

export type ScheduleErrors = {
  /** everyMinutes, maxRuns, startAt, slots */
  fields: Record<string, string>;
  /** One message per slot row, by index. */
  slots: Record<number, string>;
};

export function scheduleErrors(issues: Issue[]): ScheduleErrors {
  const errors: ScheduleErrors = { fields: {}, slots: {} };
  for (const issue of issues) {
    if (!issue.path.startsWith('schedule.')) continue;
    const rest = issue.path.slice('schedule.'.length);
    const slot = /^slots\.(\d+)/.exec(rest);
    if (slot) errors.slots[Number(slot[1])] ??= issue.message;
    else errors.fields[rest] ??= issue.message;
  }
  return errors;
}

const DASH = '–';

/** The "Zusammenfassung" card next to the wizard. */
export function summarise(
  draft: WizardDraft,
  customers: { id: string; name: string }[],
  now: Date,
): SummaryRowView[] {
  const schedule = scheduleSchema.safeParse(toSchedule(draft.schedule, now));
  const scheduleText = schedule.success
    ? Object.values(describeSchedule(schedule.data)).join(' · ')
    : DASH;
  return [
    {
      label: 'Kunde',
      value: customers.find((customer) => customer.id === draft.customerId)?.name ?? DASH,
    },
    {
      label: 'Website',
      value: draft.startUrl.trim() ? displayUrl(normaliseUrl(draft.startUrl)) : DASH,
    },
    { label: 'Job-Name', value: draft.name.trim() || DASH },
    {
      label: 'Ablauf',
      value: draft.steps.length > 0 ? plural(draft.steps.length, 'Schritt', 'Schritte') : DASH,
    },
    { label: 'Zeitplan', value: scheduleText },
    { label: 'Geräte', value: draft.devices.map(deviceLabel).join(', ') || DASH },
  ];
}

/** "24 Starts × 2 Geräte = 48 Läufe", or null while the schedule is invalid. */
export function describeRunTotal(draft: WizardDraft, now: Date): string | null {
  const parsed = scheduleSchema.safeParse(toSchedule(draft.schedule, now));
  if (!parsed.success || draft.devices.length === 0) return null;
  const schedule = parsed.data;
  const starts =
    schedule.type === 'interval'
      ? schedule.maxRuns
      : schedule.slots.reduce((sum, slot) => sum + slot.bots, 0);
  const devices = draft.devices.length;
  return `${plural(starts, 'Start', 'Starts')} × ${plural(devices, 'Gerät', 'Geräte')} = ${plural(
    starts * devices,
    'Lauf',
    'Läufe',
  )}`;
}
