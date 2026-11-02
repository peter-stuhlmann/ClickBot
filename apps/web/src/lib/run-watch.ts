/** What the worker sends to a watcher of a run ("Live zuschauen"), see watch-stream in the worker. */
export type WatchMessage =
  | { type: 'waiting' }
  | { type: 'frame'; data: string }
  | { type: 'hidden' }
  | { type: 'step'; index: number; total: number; status: WatchStepStatus }
  | { type: 'ended'; status: string }
  | { type: 'error'; message: string };

export type WatchStepStatus = 'running' | 'passed' | 'unclear' | 'failed';

export type RunWatchState = {
  status: 'connecting' | 'waiting' | 'live' | 'hidden' | 'ended' | 'error';
  /** The newest picture of the page, as a data URL. */
  frame: string | null;
  step: { index: number; total: number; status: WatchStepStatus } | null;
  message: string | null;
};

export const INITIAL_WATCH: RunWatchState = {
  status: 'connecting',
  frame: null,
  step: null,
  message: null,
};

const STEP_STATUSES = new Set<string>(['running', 'passed', 'unclear', 'failed']);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** A message of the worker, or null for anything else: the connection is not trusted blindly. */
export function parseWatchMessage(raw: string): WatchMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'waiting':
    case 'hidden':
      return { type: message.type };
    case 'frame':
      return typeof message.data === 'string' ? { type: 'frame', data: message.data } : null;
    case 'step': {
      const { index, total, status } = message;
      return isCount(index) &&
        isCount(total) &&
        typeof status === 'string' &&
        STEP_STATUSES.has(status)
        ? { type: 'step', index, total, status: status as WatchStepStatus }
        : null;
    }
    case 'ended':
      return typeof message.status === 'string' ? { type: 'ended', status: message.status } : null;
    case 'error':
      return typeof message.message === 'string'
        ? { type: 'error', message: message.message }
        : null;
    default:
      return null;
  }
}

/** The next state of the live view; `closed` is the connection ending without a word. */
export function watchReducer(
  state: RunWatchState,
  message: WatchMessage | { type: 'closed' },
): RunWatchState {
  switch (message.type) {
    case 'waiting':
      return { ...state, status: 'waiting' };
    case 'frame':
      return { ...state, status: 'live', frame: `data:image/jpeg;base64,${message.data}` };
    case 'hidden':
      // The last picture might be the one before the secret appeared: away with it, too.
      return { ...state, status: 'hidden', frame: null };
    case 'step':
      return {
        ...state,
        step: { index: message.index, total: message.total, status: message.status },
      };
    case 'ended':
      return { ...state, status: 'ended' };
    case 'error':
      return { ...state, status: 'error', message: message.message };
    case 'closed':
      return state.status === 'ended' || state.status === 'error'
        ? state
        : { ...state, status: 'error', message: 'Die Verbindung zum Testsystem ist abgebrochen.' };
  }
}

const OVERLAY: Partial<Record<RunWatchState['status'], string>> = {
  connecting: 'Verbinde mit dem Testsystem …',
  waiting: 'Wartet auf einen freien Browser …',
  hidden: 'Ausgeblendet: Die Seite zeigt gerade Zugangsdaten.',
};

/** The line below the picture (the step going on) and the text instead of a picture. */
export function describeWatch(
  state: RunWatchState,
  stepTitles: string[],
): { caption: string | null; overlay: string | null } {
  const { step } = state;
  const title = step ? stepTitles[step.index] : undefined;
  const caption = step
    ? `Schritt ${step.index + 1} von ${step.total}${title ? ` · ${title}` : ''}`
    : null;
  const overlay =
    OVERLAY[state.status] ??
    (state.status === 'error' ? state.message : state.frame ? null : 'Noch kein Bild.');
  return { caption, overlay };
}
