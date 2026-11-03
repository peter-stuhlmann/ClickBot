import type { Browser } from '@click-bot/db';
import type { Page } from 'playwright';

/** How a run ends. */
export type RunEnd = 'passed' | 'warning' | 'not_passed' | 'failed';

/** A step of a watched run: started, or how it ended. */
export type StepStatus = 'running' | 'passed' | 'unclear' | 'failed';

export type RunEvent =
  /** The run works in this page from now on (the first one, or a new tab). */
  | { type: 'page'; page: Page }
  | { type: 'step'; index: number; total: number; status: StepStatus }
  | { type: 'end'; status: RunEnd };

/** What runFlow reports about a run while it goes. */
export type RunTap = {
  page(page: Page): void;
  step(index: number, status: StepStatus): void;
  end(status: RunEnd): void;
};

/** A run being executed right now, as a watcher sees it. */
export type WatchedRun = {
  runId: string;
  engine: Browser;
  /** Values of the run's secrets: a page showing one in the clear is not shown. */
  secrets: string[];
  page(): Page | null;
  lastStep(): Extract<RunEvent, { type: 'step' }> | null;
  subscribe(listener: (event: RunEvent) => void): () => void;
};

export type RunWatchRegistry = {
  /** Called by the worker when a run starts; its tap goes to runFlow. */
  start(runId: string, info: { engine: Browser; secrets: string[]; total: number }): RunTap;
  find(runId: string): WatchedRun | undefined;
  /** Resolves when the run starts (at once if it runs already); `signal` stops waiting. */
  started(runId: string, signal?: AbortSignal): Promise<WatchedRun>;
};

/**
 * The runs of this worker that can be watched ("Live zuschauen"). Only what is in memory: a
 * watcher of a run that has not started yet waits for it.
 */
export function createRunWatchRegistry(): RunWatchRegistry {
  const runs = new Map<string, WatchedRun>();
  const waiting = new Map<string, Set<(run: WatchedRun) => void>>();

  return {
    start(runId, info) {
      let page: Page | null = null;
      let last: Extract<RunEvent, { type: 'step' }> | null = null;
      const listeners = new Set<(event: RunEvent) => void>();
      const emit = (event: RunEvent) => {
        for (const listener of [...listeners]) listener(event);
      };
      const watched: WatchedRun = {
        runId,
        engine: info.engine,
        secrets: info.secrets.filter(Boolean),
        page: () => page,
        lastStep: () => last,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      runs.set(runId, watched);
      for (const resolve of waiting.get(runId) ?? []) resolve(watched);
      waiting.delete(runId);

      return {
        page(next) {
          page = next;
          emit({ type: 'page', page: next });
        },
        step(index, status) {
          last = { type: 'step', index, total: info.total, status };
          emit(last);
        },
        end(status) {
          runs.delete(runId);
          emit({ type: 'end', status });
          listeners.clear();
        },
      };
    },

    find: (runId) => runs.get(runId),

    started(runId, signal) {
      const running = runs.get(runId);
      if (running) return Promise.resolve(running);
      return new Promise((resolve) => {
        const set = waiting.get(runId) ?? new Set();
        set.add(resolve);
        waiting.set(runId, set);
        signal?.addEventListener('abort', () => {
          set.delete(resolve);
          if (set.size === 0 && waiting.get(runId) === set) waiting.delete(runId);
        });
      });
    },
  };
}
