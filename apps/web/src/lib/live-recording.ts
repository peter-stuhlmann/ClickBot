import { KEY_PATTERN, stepSchema } from '@click-bot/shared';
import { toStepDraft, type StepDraft } from './job-draft';
import type { LiveInput, LiveMode } from './views';

export type LiveViewport = { width: number; height: number };
export type RecordedDraft = StepDraft;

/** What the live browser on the worker sends; steps stay raw until addRecordedStep checks them. */
export type LiveMessage =
  | { type: 'ready'; viewport: LiveViewport; url: string }
  | { type: 'frame'; data: string }
  | { type: 'url'; url: string }
  | { type: 'step'; step: unknown }
  | { type: 'mode'; mode: LiveMode }
  | { type: 'error'; message: string };

const RECORDABLE = new Set([
  'open',
  'click',
  'fill',
  'select',
  'assert',
  'press',
  'scroll',
  'screenshot',
  'wait',
]);
// Copy, cut and paste stay in the own browser; pasting sends the text (onPaste).
const OWN_SHORTCUTS = new Set(['c', 'v', 'x']);

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));

/** A point on the stream as shown (`shown` from getBoundingClientRect) in the live browser. */
export function toViewport(
  clientX: number,
  clientY: number,
  shown: { left: number; top: number; width: number; height: number },
  viewport: LiveViewport,
): { x: number; y: number } {
  return {
    x: clamp(((clientX - shown.left) / shown.width) * viewport.width, viewport.width),
    y: clamp(((clientY - shown.top) / shown.height) * viewport.height, viewport.height),
  };
}

/**
 * A key pressed on the stream: characters as text, other keys and combinations by name, as the
 * recording keeps them („Shift+Tab“, „Control+a“). Copying and pasting stay with the user's own
 * browser, and so do keys a flow cannot press, like F12.
 */
export function keyInput(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
}): LiveInput | null {
  const command = event.ctrlKey || event.metaKey || event.altKey;
  const single = [...event.key].length === 1;
  if (single && !command) return { type: 'text', text: event.key };
  if ((event.ctrlKey || event.metaKey) && OWN_SHORTCUTS.has(event.key.toLowerCase())) return null;
  // A capital letter carries its Shift already, unless a shortcut needs it spelled out.
  const shift = event.shiftKey && (!single || command);
  const key = [
    event.ctrlKey && 'Control',
    event.altKey && 'Alt',
    shift && 'Shift',
    event.metaKey && 'Meta',
    event.key === ' ' ? 'Space' : event.key,
  ]
    .filter(Boolean)
    .join('+');
  return KEY_PATTERN.test(key) ? { type: 'key', key } : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRecordableStep(step: unknown): boolean {
  return isObject(step) && RECORDABLE.has(String(step.type));
}

export function parseLiveMessage(raw: string): LiveMessage | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(message)) return null;
  switch (message.type) {
    case 'ready':
      return isObject(message.viewport) && typeof message.url === 'string'
        ? (message as LiveMessage)
        : null;
    case 'frame':
      return typeof message.data === 'string' ? { type: 'frame', data: message.data } : null;
    case 'url':
      return typeof message.url === 'string' ? { type: 'url', url: message.url } : null;
    case 'step':
      return isRecordableStep(message.step) ? { type: 'step', step: message.step } : null;
    case 'mode':
      return message.mode === 'record' || message.mode === 'assert'
        ? { type: 'mode', mode: message.mode }
        : null;
    case 'error':
      return typeof message.message === 'string'
        ? { type: 'error', message: message.message }
        : null;
    default:
      return null;
  }
}

const sameField = (a: StepDraft, b: StepDraft) =>
  a.type === 'fill' &&
  b.type === 'fill' &&
  a.targetBy === b.targetBy &&
  a.targetRole === b.targetRole &&
  a.targetValue === b.targetValue;

// Scrolling on, without anything in between: one step, where the page came to rest.
const bothScrolled = (a: StepDraft, b: StepDraft) =>
  a.type === 'scroll' &&
  b.type === 'scroll' &&
  a.scrollKind === 'position' &&
  b.scrollKind === 'position';

function nextId(steps: StepDraft[]): string {
  const numbers = steps.map((step) => Number(/^aufnahme-(\d+)$/.exec(step.id)?.[1] ?? 0));
  return `aufnahme-${Math.max(0, ...numbers) + 1}`;
}

/**
 * Adds a step from the live browser as an editable draft. Typing into the same field again right
 * away replaces the value instead of adding a step, and so does scrolling on. Steps the form
 * cannot show are left out.
 */
export function addRecordedStep(steps: RecordedDraft[], step: unknown): RecordedDraft[] {
  if (!isRecordableStep(step)) return steps;
  const parsed = stepSchema.safeParse({ ...(step as object), id: nextId(steps) });
  const draft = parsed.success ? toStepDraft(parsed.data) : null;
  if (!draft) return steps;
  const last = steps.at(-1);
  if (last && (sameField(last, draft) || bothScrolled(last, draft))) {
    return [...steps.slice(0, -1), { ...draft, id: last.id }];
  }
  return [...steps, draft];
}
