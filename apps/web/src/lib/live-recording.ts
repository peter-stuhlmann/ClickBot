import { stepSchema } from '@click-bot/shared';
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

const RECORDABLE = new Set(['open', 'click', 'fill', 'select', 'assert']);
const KEYS = new Set([
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'Escape',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

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
 * A key pressed on the stream: characters as text, a few editing keys by name. Shortcuts stay
 * with the user's own browser (copy, paste, developer tools).
 */
export function keyInput(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): LiveInput | null {
  if (event.ctrlKey || event.metaKey) return null;
  if (KEYS.has(event.key)) return { type: 'key', key: event.key };
  if ([...event.key].length === 1) return { type: 'text', text: event.key };
  return null;
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
      return message.mode === 'record' || message.mode === 'browse' || message.mode === 'assert'
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

function nextId(steps: StepDraft[]): string {
  const numbers = steps.map((step) => Number(/^aufnahme-(\d+)$/.exec(step.id)?.[1] ?? 0));
  return `aufnahme-${Math.max(0, ...numbers) + 1}`;
}

/**
 * Adds a step from the live browser as an editable draft. Typing into the same field again right
 * away replaces the value instead of adding a step. Steps the form cannot show are left out.
 */
export function addRecordedStep(steps: RecordedDraft[], step: unknown): RecordedDraft[] {
  if (!isRecordableStep(step)) return steps;
  const parsed = stepSchema.safeParse({ ...(step as object), id: nextId(steps) });
  const draft = parsed.success ? toStepDraft(parsed.data) : null;
  if (!draft) return steps;
  const last = steps.at(-1);
  if (last && sameField(last, draft)) return [...steps.slice(0, -1), { ...draft, id: last.id }];
  return [...steps, draft];
}
