import {
  ALL_MARKINGS_ON,
  DEFAULT_TIMEZONE,
  FLAT_CURVE,
  WEEKDAYS,
  deviceBrowserProblems,
  describeMarking,
  flowSchema,
  markingState,
  localToUtc,
  normalizeDeviceBrowsers,
  runTargets,
  scheduleSchema,
  type AnalyticsMarking,
  type DeviceBrowsers,
  type Flow,
  type Schedule,
  type ScrollDirection,
  type Step,
  type Target,
  type Weekday,
} from '@click-bot/shared';
import { addDays } from './calendar';
import { describeTargets, type DeviceKey } from './devices';
import { describeSchedule, displayUrl, plural } from './format';
import type { SummaryRowView } from './views';

/**
 * State of the "Neuer Job" wizard. Form fields keep what was typed (numbers as text), so a
 * half-filled form survives; the to* functions turn it into input for createJob, and the
 * schemas from @click-bot/shared decide what is valid, on the client and again on the server.
 */

export const WIZARD_STEPS = [
  {
    key: 'test',
    label: 'Website & Test',
    question: 'Welche Website, und was soll geprüft werden?',
  },
  { key: 'schedule', label: 'Wann', question: 'Wann soll der Test laufen?' },
  {
    key: 'devices',
    label: 'Geräte & Freigabe',
    question: 'Auf welchen Geräten, und unter welchem Namen?',
  },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]['key'];

export type EditableStepType =
  | 'open'
  | 'click'
  | 'fill'
  | 'select'
  | 'press'
  | 'scroll'
  | 'assert'
  | 'wait'
  | 'screenshot'
  | 'analytics'
  | 'basicAuth'
  | 'ai';
/** Edge: to the edge of the page in `scrollDirection`, stored as top, bottom, left or right. */
export type ScrollKind = 'by' | 'position' | 'element' | 'edge';
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
  /** fill: value · select: option · assert: text · analytics: event · screenshot: name · ai: task */
  value: string;
  assertKind: AssertKind;
  waitKind: WaitKind;
  waitSeconds: string;
  /**
   * scroll: from where the page stands, to a position (pixels from the top and the left), until
   * an element is in view, or to an edge.
   */
  scrollKind: ScrollKind;
  scrollY: string;
  /** Empty: the page keeps its horizontal position. */
  scrollX: string;
  /** scroll "by" and "edge" */
  scrollDirection: ScrollDirection;
  scrollDistance: string;
  /** press: a key or combination, e.g. „Escape“ or „Control+a“. */
  key: string;
  /** press: on the element of the target fields, which gets the focus first. */
  pressOnElement: boolean;
  fullPage: boolean;
  timeoutSeconds: string;
  /** basicAuth (.htaccess) */
  username: string;
  /** basicAuth: a newly typed password. Empty keeps `storedPassword`. */
  password: string;
  /**
   * basicAuth: the stored password, a `{{secret.…}}` reference. It never goes into the form,
   * only back to the server unchanged.
   */
  storedPassword: string;
};

export type SlotDraft = { key: string; date: string; time: string; bots: number };

export type ScheduleDraft = {
  type: 'interval' | 'times' | 'random';
  everyMinutes: string;
  maxRuns: string;
  startMode: 'now' | 'at';
  startDate: string;
  startTime: string;
  /**
   * The stored start of an interval (ISO, with seconds). Saved unchanged while date and time
   * still show it, so merely saving a job never moves its starts.
   */
  storedStartAt: string | null;
  slots: SlotDraft[];
  /** Start the bots of a slot `staggerSeconds` apart instead of in the same second. */
  stagger: boolean;
  staggerSeconds: number;
  /** random: the period (calendar days, both included) and how many runs it gets. */
  randomFrom: string;
  randomTo: string;
  randomRuns: string;
  /** random: per weekday 25 points from 0 to 24 o'clock; 0 never, 1 normal, 2 twice as often. */
  curves: Record<Weekday, number[]>;
  /** random: drawn once per job, so the same settings always give the same starts. */
  seed: number;
};

export type WizardDraft = {
  /** The campaign the job belongs to (its project is the current one). */
  campaignId: string;
  startUrl: string;
  name: string;
  /** The user confirmed that the website is their own or the customer approved the test. */
  confirmed: boolean;
  steps: StepDraft[];
  schedule: ScheduleDraft;
  devices: DeviceKey[];
  /**
   * The browsers of each device; also of devices switched off again, so switching one on
   * brings its browsers back. iPhone and iPad always run in Safari (runTargets).
   */
  deviceBrowsers: DeviceBrowsers;
  /** Which GA4 markers the bot runs set (all on by default). */
  analyticsMarking: AnalyticsMarking;
  /** Whether the bot runs stop requests to ad networks (on by default). */
  blockAds: boolean;
};

export type Issue = { path: string; message: string };

export type NewJobDraftInput = {
  campaignId: string;
  name: string;
  startUrl: string;
  flow: { version: 1; steps: Record<string, unknown>[] };
  schedule: Record<string, unknown>;
  devices: DeviceKey[];
  deviceBrowsers: DeviceBrowsers;
  analyticsMarking: AnalyticsMarking;
  blockAds: boolean;
  status: 'active';
};

const HOUR_MS = 3_600_000;
const STAGGER_SECONDS = 10;
const SEED_LIMIT = 2 ** 31 - 1;

/** Every weekday evenly: the default of a random plan. */
export function evenCurves(): Record<Weekday, number[]> {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, [...FLAT_CURVE]])) as Record<
    Weekday,
    number[]
  >;
}
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
  const today = berlinDate.format(now);
  return {
    campaignId: '',
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
      storedStartAt: null,
      slots: [{ key: 'slot-1', date, time, bots: 1 }],
      stagger: true,
      staggerSeconds: STAGGER_SECONDS,
      randomFrom: today,
      randomTo: addDays(today, 6),
      randomRuns: '50',
      curves: evenCurves(),
      seed: now.getTime() % SEED_LIMIT,
    },
    devices: ['desktop'],
    deviceBrowsers: { desktop: ['chromium'] },
    analyticsMarking: ALL_MARKINGS_ON,
    blockAds: true,
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

/** Buttons, links and headings are found by role and name, form fields by their label. */
export function defaultTargetBy(type: EditableStepType): TargetBy {
  return type === 'click' || type === 'scroll' ? 'role' : 'label';
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
    targetRole: type === 'scroll' ? 'heading' : 'button',
    targetValue: '',
    value: '',
    assertKind: 'textVisible',
    waitKind: 'duration',
    waitSeconds: '1',
    scrollKind: 'by',
    scrollY: '0',
    scrollX: '',
    scrollDirection: 'down',
    scrollDistance: '500',
    key: '',
    pressOnElement: false,
    fullPage: false,
    timeoutSeconds: '10',
    username: '',
    password: '',
    storedPassword: '',
  };
}

/**
 * A free test: the start page, then the goal as one AI step, which finds its way and judges the
 * goal in every run.
 */
export function stepsForAiTask(startUrl: string, goal: string): StepDraft[] {
  const open = newStep('open', [], startUrl);
  // As typed; toStep trims it when the job is saved.
  return [open, { ...newStep('ai', [open], startUrl), value: goal }];
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

const EDGES: Record<ScrollDirection, 'bottom' | 'top' | 'right' | 'left'> = {
  down: 'bottom',
  up: 'top',
  right: 'right',
  left: 'left',
};

const EDGE_DIRECTIONS = {
  bottom: 'down',
  top: 'up',
  right: 'right',
  left: 'left',
} as const satisfies Record<(typeof EDGES)[ScrollDirection], ScrollDirection>;

function toScroll(step: StepDraft): Record<string, unknown> {
  switch (step.scrollKind) {
    case 'by':
      return {
        kind: 'by',
        direction: step.scrollDirection,
        distance: toNumber(step.scrollDistance),
      };
    case 'position': {
      const x = step.scrollX.trim();
      return { kind: 'position', y: toNumber(step.scrollY), ...(x ? { x: toNumber(x) } : {}) };
    }
    case 'element':
      return { kind: 'element', target: toTarget(step) };
    case 'edge':
      return { kind: EDGES[step.scrollDirection] };
  }
}

/** A step of the forms as stored; the flow schemas check the result. */
export function toStep(step: StepDraft): Record<string, unknown> {
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
    case 'press':
      return {
        ...base,
        key: step.key.trim(),
        ...(step.pressOnElement ? { target: toTarget(step) } : {}),
      };
    case 'scroll':
      return { ...base, to: toScroll(step) };
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
    case 'ai':
      return { ...base, instruction: step.value.trim() };
    case 'basicAuth':
      // Spaces may belong to a password, so it goes as typed; the server stores it encrypted.
      return {
        ...base,
        username: step.username.trim(),
        password: step.password === '' ? step.storedPassword : step.password,
      };
  }
}

/** 2500 → "2,5": seconds as typed in the form, never with a thousands separator. */
function secondsText(ms: number): string {
  return (ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 3, useGrouping: false });
}

function targetFields(target: Target): Pick<StepDraft, 'targetBy' | 'targetRole' | 'targetValue'> {
  switch (target.by) {
    case 'role':
      return { targetBy: 'role', targetRole: target.role, targetValue: target.name ?? '' };
    case 'label':
      return { targetBy: 'label', targetRole: 'button', targetValue: target.label };
    case 'text':
      return { targetBy: 'text', targetRole: 'button', targetValue: target.text };
    case 'css':
      return { targetBy: 'css', targetRole: 'button', targetValue: target.selector };
    case 'testId':
      return { targetBy: 'testId', targetRole: 'button', targetValue: target.testId };
  }
}

/**
 * A stored step as form fields, the reverse of the wizard's conversion. Null for step types
 * the forms do not offer yet (extract, AI, code).
 */
export function toStepDraft(step: Step): StepDraft | null {
  if (step.type === 'extract') return null;
  const draft: StepDraft = {
    ...newStep(step.type, [], ''),
    id: step.id,
    timeoutSeconds: secondsText(step.timeoutMs),
  };
  switch (step.type) {
    case 'open':
      return { ...draft, url: step.url };
    case 'click':
      return { ...draft, ...targetFields(step.target) };
    case 'fill':
      return { ...draft, ...targetFields(step.target), value: step.value };
    case 'select':
      return { ...draft, ...targetFields(step.target), value: step.option };
    case 'press':
      return step.target
        ? { ...draft, key: step.key, pressOnElement: true, ...targetFields(step.target) }
        : { ...draft, key: step.key };
    case 'scroll': {
      const { to } = step;
      switch (to.kind) {
        case 'by':
          return {
            ...draft,
            scrollKind: 'by',
            scrollDirection: to.direction,
            scrollDistance: String(to.distance),
          };
        case 'position':
          return {
            ...draft,
            scrollKind: 'position',
            scrollY: String(to.y),
            scrollX: to.x === undefined ? '' : String(to.x),
          };
        case 'element':
          return { ...draft, scrollKind: 'element', ...targetFields(to.target) };
        default:
          return { ...draft, scrollKind: 'edge', scrollDirection: EDGE_DIRECTIONS[to.kind] };
      }
    }
    case 'assert': {
      const { assertion } = step;
      if (assertion.kind === 'elementVisible') {
        return { ...draft, assertKind: assertion.kind, ...targetFields(assertion.target) };
      }
      const value = assertion.kind === 'textVisible' ? assertion.text : assertion.value;
      return { ...draft, assertKind: assertion.kind, value };
    }
    case 'wait': {
      const { until } = step;
      if (until.kind === 'duration') {
        return { ...draft, waitKind: 'duration', waitSeconds: secondsText(until.ms) };
      }
      if (until.kind === 'element') {
        return { ...draft, waitKind: 'element', ...targetFields(until.target) };
      }
      return { ...draft, waitKind: 'networkIdle' };
    }
    case 'screenshot':
      return { ...draft, value: step.name ?? '', fullPage: step.fullPage };
    case 'analytics':
      return { ...draft, value: step.event };
    case 'ai':
      return { ...draft, value: step.instruction };
    case 'basicAuth':
      return { ...draft, username: step.username, storedPassword: step.password };
  }
}

function startInstant(schedule: ScheduleDraft, now: Date): Date | null {
  if (schedule.startMode === 'now') return now;
  if (!DATE.test(schedule.startDate) || !TIME.test(schedule.startTime)) return null;
  const stored = schedule.storedStartAt ? new Date(schedule.storedStartAt) : null;
  if (
    stored &&
    berlinDate.format(stored) === schedule.startDate &&
    berlinTime.format(stored) === schedule.startTime
  ) {
    return stored;
  }
  return localToUtc(schedule.startDate, schedule.startTime, DEFAULT_TIMEZONE);
}

function toSchedule(schedule: ScheduleDraft, now: Date): Record<string, unknown> {
  if (schedule.type === 'random') {
    return {
      type: 'random',
      from: schedule.randomFrom,
      to: schedule.randomTo,
      runs: toNumber(schedule.randomRuns),
      curves: schedule.curves,
      seed: schedule.seed,
      // Only starts from now on; the server keeps what ran when a plan with runs changes.
      drawFrom: now.toISOString(),
      timezone: DEFAULT_TIMEZONE,
    };
  }
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
    staggerSeconds: schedule.stagger ? schedule.staggerSeconds : 0,
    timezone: DEFAULT_TIMEZONE,
  };
}

/** Input for createJob. The job starts as active: saving is the last step of the wizard. */
export function toNewJobInput(draft: WizardDraft, now: Date): NewJobDraftInput {
  return {
    campaignId: draft.campaignId,
    name: draft.name.trim(),
    startUrl: normaliseUrl(draft.startUrl),
    flow: { version: 1, steps: draft.steps.map(toStep) },
    schedule: toSchedule(draft.schedule, now),
    devices: draft.devices,
    deviceBrowsers: normalizeDeviceBrowsers(draft.devices, draft.deviceBrowsers),
    analyticsMarking: draft.analyticsMarking,
    blockAds: draft.blockAds,
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

/** Step 1: project and name. */
function jobIssues(draft: WizardDraft): Issue[] {
  const issues: Issue[] = [];
  if (!draft.campaignId) {
    issues.push({ path: 'campaignId', message: 'Bitte eine Kampagne wählen.' });
  }
  if (!draft.name.trim()) issues.push({ path: 'name', message: 'Name fehlt.' });
  return issues;
}

/** Step 2 asks for the start address above the flow. */
function startUrlIssues(draft: WizardDraft): Issue[] {
  return isHttpUrl(normaliseUrl(draft.startUrl))
    ? []
    : [{ path: 'startUrl', message: 'Die Adresse muss mit http:// oder https:// beginnen.' }];
}

function flowIssues(draft: WizardDraft, now: Date): Issue[] {
  const parsed = flowSchema.safeParse(toNewJobInput(draft, now).flow);
  return parsed.success ? [] : issuesFrom('flow', parsed.error);
}

function deviceIssues(draft: WizardDraft): Issue[] {
  if (draft.devices.length === 0) {
    return [{ path: 'devices', message: 'Mindestens ein Gerät wählen.' }];
  }
  return Object.entries(deviceBrowserProblems(draft.devices, draft.deviceBrowsers)).map(
    ([device, message]) => ({ path: `deviceBrowsers.${device}`, message }),
  );
}

/** Product rule: whoever creates a job confirms that the website may be tested (last step). */
function confirmationIssues(draft: WizardDraft): Issue[] {
  return draft.confirmed
    ? []
    : [{ path: 'confirmed', message: 'Bitte bestätigen, dass ihr diese Website testen dürft.' }];
}

/**
 * Schema problems plus starts in the past. With `original` (the editor), starts that were
 * already saved may stay in the past: a running job has done most of them.
 */
function scheduleIssues(schedule: ScheduleDraft, now: Date, original?: ScheduleDraft): Issue[] {
  const parsed = scheduleSchema.safeParse(toSchedule(schedule, now));
  if (!parsed.success) return issuesFrom('schedule', parsed.error);

  if (schedule.type === 'interval') {
    const start = startInstant(schedule, now);
    const unchanged =
      original?.type === 'interval' &&
      original.startMode === 'at' &&
      original.startDate === schedule.startDate &&
      original.startTime === schedule.startTime;
    return start && start < now && !unchanged
      ? [{ path: 'schedule.startAt', message: 'Der Start liegt in der Vergangenheit.' }]
      : [];
  }
  const saved = new Set(
    original?.type === 'times' ? original.slots.map((slot) => `${slot.date} ${slot.time}`) : [],
  );
  return schedule.slots.flatMap((slot, index) => {
    const start = localToUtc(slot.date, slot.time, DEFAULT_TIMEZONE);
    return start && start < now && !saved.has(`${slot.date} ${slot.time}`)
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
    case 'test':
      return [...startUrlIssues(draft), ...flowIssues(draft, now)];
    case 'schedule':
      return scheduleIssues(draft.schedule, now);
    case 'devices':
      return [...deviceIssues(draft), ...jobIssues(draft), ...confirmationIssues(draft)];
  }
}

const NAME_LIMIT = 60;

/**
 * A name for the test, before the user types one: the first sentence of the goal of a free
 * test, or "Test auf <website>" for a fixed flow. Empty while there is nothing to go by.
 */
export function suggestName(draft: Pick<WizardDraft, 'startUrl' | 'steps'>): string {
  const goal = draft.steps.find((step) => step.type === 'ai')?.value.trim() ?? '';
  if (goal) {
    const sentence = (goal.split(/(?<=[.!?])\s/)[0] ?? goal).replace(/[.!?]+$/, '').trim();
    if (sentence.length <= NAME_LIMIT) return sentence;
    const cut = sentence.slice(0, NAME_LIMIT - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trimEnd()}…`;
  }
  try {
    const host = new URL(normaliseUrl(draft.startUrl)).hostname.replace(/^www\./, '');
    return host ? `Test auf ${host}` : '';
  } catch {
    return '';
  }
}

/** "GA4-Markierung aus" or "GA4-Markierung aus: Debug-Modus"; null while everything is on. */
function markingSummary(marking: AnalyticsMarking): string | null {
  const state = markingState(marking);
  if (state === 'on') return null;
  if (state === 'off') return 'GA4-Markierung aus';
  return `GA4-Markierung ${(describeMarking(marking) ?? '').replace(/^Aus/, 'aus')}`;
}

/**
 * One line for the collapsed "Erweiterte Einstellungen": what GA4 marking and ad blocking stand
 * at, and whether anything differs from the recommended defaults.
 */
export function describeAdvanced(draft: Pick<WizardDraft, 'analyticsMarking' | 'blockAds'>): {
  summary: string;
  changed: boolean;
} {
  const marking = markingSummary(draft.analyticsMarking) ?? 'GA4-Markierung an';
  const ads = draft.blockAds ? 'Werbung blockiert' : 'Werbung erlaubt';
  return {
    summary: `${marking} · ${ads}`,
    changed: markingState(draft.analyticsMarking) !== 'on' || !draft.blockAds,
  };
}

export type JobUpdateDraftInput = Omit<NewJobDraftInput, 'status'>;

/** Input for updateJob from the editor: the job keeps its status and may change campaign. */
export function toJobUpdateInput(draft: WizardDraft, now: Date): JobUpdateDraftInput {
  const { status: _status, ...input } = toNewJobInput(draft, now);
  return input;
}

/** Problems that keep the editor from saving; `original` is the job as loaded. */
export function validateJobEdit(draft: WizardDraft, original: WizardDraft, now: Date): Issue[] {
  return [
    ...jobIssues(draft),
    ...startUrlIssues(draft),
    ...flowIssues(draft, now),
    ...scheduleIssues(draft.schedule, now, original.schedule),
    ...deviceIssues(draft),
  ];
}

export type StoredJob = {
  campaignId: string;
  name: string;
  startUrl: string;
  flow: Flow;
  schedule: Schedule;
  devices: readonly DeviceKey[];
  deviceBrowsers: DeviceBrowsers;
  analyticsMarking: AnalyticsMarking;
  blockAds: boolean;
};

/**
 * A saved job as editor state, or why the editor cannot show it without losing something:
 * step types without a form, or dates in another time zone than the forms use.
 */
export function jobToDraft(
  job: StoredJob,
  now: Date,
): { draft: WizardDraft } | { notEditable: string } {
  const steps = job.flow.steps.map(toStepDraft);
  if (steps.some((step) => step === null)) {
    return {
      notEditable: 'Der Ablauf enthält Schritte, die der Editor noch nicht kann (Auslesen).',
    };
  }
  const { schedule } = job;
  if (schedule.type !== 'interval' && schedule.timezone !== DEFAULT_TIMEZONE) {
    return {
      notEditable: `Der Zeitplan nutzt die Zeitzone ${schedule.timezone}, der Editor kennt nur ${DEFAULT_TIMEZONE}.`,
    };
  }

  const defaults = emptyDraft(now).schedule;
  const scheduleDraft: ScheduleDraft =
    schedule.type === 'random'
      ? {
          ...defaults,
          type: 'random',
          randomFrom: schedule.from,
          randomTo: schedule.to,
          randomRuns: String(schedule.runs),
          curves: { ...evenCurves(), ...schedule.curves },
          seed: schedule.seed,
        }
      : schedule.type === 'interval'
        ? {
            ...defaults,
            type: 'interval',
            everyMinutes: String(schedule.everyMinutes),
            maxRuns: String(schedule.maxRuns),
            startMode: 'at',
            startDate: berlinDate.format(new Date(schedule.startAt)),
            startTime: berlinTime.format(new Date(schedule.startAt)),
            storedStartAt: schedule.startAt,
          }
        : {
            ...defaults,
            type: 'times',
            slots: schedule.slots.map((slot, index) => ({ key: `slot-${index + 1}`, ...slot })),
            stagger: schedule.staggerSeconds > 0,
            staggerSeconds: schedule.staggerSeconds || STAGGER_SECONDS,
          };

  return {
    draft: {
      campaignId: job.campaignId,
      name: job.name,
      startUrl: job.startUrl,
      // Confirmed when the job was created.
      confirmed: true,
      steps: steps as StepDraft[],
      schedule: scheduleDraft,
      devices: [...job.devices],
      deviceBrowsers: { ...job.deviceBrowsers },
      analyticsMarking: job.analyticsMarking,
      blockAds: job.blockAds,
    },
  };
}

export type StepListState = { steps: StepDraft[]; selected: number | null };

/** Adds a click step (or, to an empty flow, the opening of the start URL) and selects it. */
export function appendStep(steps: StepDraft[], startUrl: string): StepListState {
  const step = newStep(steps.length === 0 ? 'open' : 'click', steps, startUrl);
  return { steps: [...steps, step], selected: steps.length };
}

/** Moves a step one place; it stays selected. A move past either end changes nothing. */
export function moveStep(steps: StepDraft[], index: number, delta: -1 | 1): StepListState {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return { steps, selected: index };
  const moved = [...steps];
  [moved[index], moved[target]] = [moved[target] as StepDraft, moved[index] as StepDraft];
  return { steps: moved, selected: target };
}

/** Removes a step and keeps the selection on the same step, or its neighbour if it was removed. */
export function removeStep(
  steps: StepDraft[],
  index: number,
  selected: number | null,
): StepListState {
  const remaining = steps.filter((_, other) => other !== index);
  if (selected === null || remaining.length === 0) return { steps: remaining, selected: null };
  if (selected > index || selected === remaining.length) {
    return { steps: remaining, selected: selected - 1 };
  }
  return { steps: remaining, selected };
}

/**
 * Sets the start address. While the flow is empty or still begins with opening the old address,
 * the first step follows; a first step changed by hand stays as it is.
 */
export function withStartUrl(
  draft: WizardDraft,
  startUrl: string,
): Pick<WizardDraft, 'startUrl' | 'steps'> {
  const [first, ...rest] = draft.steps;
  if (!first) return { startUrl, steps: [newStep('open', [], startUrl)] };
  if (first.type === 'open' && first.url === normaliseUrl(draft.startUrl)) {
    return { startUrl, steps: [{ ...first, url: normaliseUrl(startUrl) }, ...rest] };
  }
  return { startUrl, steps: draft.steps };
}

/** The wizard step that shows the field at `path`, e.g. after the server rejected the job. */
export function wizardStepOf(path: string): WizardStep {
  const [head] = path.split('.');
  if (head === 'schedule') return 'schedule';
  if (head === 'flow' || head === 'startUrl') return 'test';
  return 'devices';
}

/** The browser problems by device, e.g. { android: 'Mindestens einen Browser wählen.' }. */
export function browserErrors(issues: Issue[]): Partial<Record<DeviceKey, string>> {
  const errors: Partial<Record<DeviceKey, string>> = {};
  for (const { path, message } of issues) {
    const [head, device] = path.split('.');
    if (head === 'deviceBrowsers' && device) errors[device as DeviceKey] ??= message;
  }
  return errors;
}

/** First message per path, for fields that show a single error. */
export function errorsByPath(issues: Issue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path] ??= issue.message;
  return errors;
}

export type StepField =
  | 'url'
  | 'targetRole'
  | 'targetValue'
  | 'value'
  | 'waitSeconds'
  | 'scrollY'
  | 'scrollX'
  | 'scrollDistance'
  | 'key'
  | 'timeoutSeconds'
  | 'username'
  | 'password'
  | 'general';

const VALUE_PATHS = new Set([
  'value',
  'option',
  'event',
  'name',
  'assertion.text',
  'assertion.value',
  'instruction',
]);

function stepField(rest: string): StepField {
  if (rest === 'url' || rest === 'username' || rest === 'password') return rest;
  if (rest === 'timeoutMs') return 'timeoutSeconds';
  if (rest === 'until.ms') return 'waitSeconds';
  if (rest === 'to.y') return 'scrollY';
  if (rest === 'to.x') return 'scrollX';
  if (rest === 'to.distance') return 'scrollDistance';
  if (rest === 'key') return 'key';
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
  campaigns: { id: string; name: string }[],
  now: Date,
): SummaryRowView[] {
  const schedule = scheduleSchema.safeParse(toSchedule(draft.schedule, now));
  const scheduleText = schedule.success
    ? Object.values(describeSchedule(schedule.data)).join(' · ')
    : DASH;
  const free = draft.steps.some((step) => step.type === 'ai');
  const test = free
    ? 'Frei mit KI'
    : draft.steps.length > 0
      ? `Fester Ablauf · ${plural(draft.steps.length, 'Schritt', 'Schritte')}`
      : DASH;
  // Technical settings only when they differ from the defaults: the summary stays short.
  const changed = [
    markingSummary(draft.analyticsMarking),
    draft.blockAds ? null : 'Werbung erlaubt',
  ].filter((part): part is string => Boolean(part));
  return [
    {
      label: 'Website',
      value: draft.startUrl.trim() ? displayUrl(normaliseUrl(draft.startUrl)) : DASH,
    },
    { label: 'Test', value: test },
    { label: 'Zeitplan', value: scheduleText },
    { label: 'Geräte', value: describeTargets(draft.devices, draft.deviceBrowsers) || DASH },
    { label: 'Name', value: draft.name.trim() || DASH },
    ...(campaigns.length > 1
      ? [
          {
            label: 'Kampagne',
            value: campaigns.find((campaign) => campaign.id === draft.campaignId)?.name ?? DASH,
          },
        ]
      : []),
    ...(changed.length > 0 ? [{ label: 'Erweitert', value: changed.join(' · ') }] : []),
  ];
}

/**
 * "24 Starts × 2 Geräte = 48 Läufe", or "× 3 Kombinationen" when a device runs in several
 * browsers; null while the schedule is invalid or nothing would run.
 */
export function describeRunTotal(draft: WizardDraft, now: Date): string | null {
  const parsed = scheduleSchema.safeParse(toSchedule(draft.schedule, now));
  const targets = runTargets(draft.devices, draft.deviceBrowsers).length;
  if (!parsed.success || targets === 0) return null;
  const schedule = parsed.data;
  const starts =
    schedule.type === 'interval'
      ? schedule.maxRuns
      : schedule.type === 'random'
        ? schedule.runs
        : schedule.slots.reduce((sum, slot) => sum + slot.bots, 0);
  const perStart =
    targets === new Set(draft.devices).size
      ? plural(targets, 'Gerät', 'Geräte')
      : plural(targets, 'Kombination', 'Kombinationen');
  return `${plural(starts, 'Start', 'Starts')} × ${perStart} = ${plural(
    starts * targets,
    'Durchlauf',
    'Durchläufe',
  )}`;
}
