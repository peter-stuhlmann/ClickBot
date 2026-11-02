'use client';

import { useEffect, useEffectEvent, useReducer } from 'react';
import {
  INITIAL_WATCH,
  parseWatchMessage,
  watchReducer,
  type RunWatchState,
  type WatchMessage,
} from '@/lib/run-watch';
import type { WatchRunAction } from '@/lib/views';

const NO_CONNECTION = 'Keine Verbindung zum Testsystem.';

type Watched = { runId: string | null; view: RunWatchState };
type Received = { runId: string; message: WatchMessage | { type: 'closed' } };

/** A message for another run (or the first one) starts from the beginning. */
function reduce(state: Watched, { runId, message }: Received): Watched {
  const view = state.runId === runId ? state.view : INITIAL_WATCH;
  return { runId, view: watchReducer(view, message) };
}

/**
 * "Live zuschauen": while `runId` is set, asks the web app for a token and shows the run as the
 * worker streams it: the page and the step it is at. `onEnded` runs when the run is over.
 */
export function useRunWatch(
  runId: string | null,
  watchAction: WatchRunAction,
  onEnded?: () => void,
): RunWatchState {
  const [watched, dispatch] = useReducer(reduce, { runId: null, view: INITIAL_WATCH });
  const ended = useEffectEvent(() => onEnded?.());

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    const receive = (message: Received['message']) => {
      if (!cancelled) dispatch({ runId, message });
    };
    watchAction(runId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) return receive({ type: 'error', message: result.message });
        socket = new WebSocket(result.url);
        socket.onmessage = (event) => {
          const message = parseWatchMessage(String(event.data));
          if (!message) return;
          receive(message);
          if (message.type === 'ended') ended();
        };
        socket.onclose = () => receive({ type: 'closed' });
      })
      .catch(() => receive({ type: 'error', message: NO_CONNECTION }));
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [runId, watchAction]);

  return watched.runId === runId ? watched.view : INITIAL_WATCH;
}
