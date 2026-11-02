'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DraftSaveResult } from '@/app/actions';
import type { WizardState } from '@/lib/wizard-state';

/** Saves this long after the last change, so typing does not send every key. */
const DELAY_MS = 600;
const NEW_JOB = '/jobs/neu';

type Options = {
  state: WizardState;
  /** Only once there is a flow: an address alone is no draft yet. A saved draft always saves. */
  worthKeeping: boolean;
  initial: { draftId: string; savedAt: string } | null;
  save: (draftId: string | null, state: WizardState) => Promise<DraftSaveResult>;
};

/**
 * Keeps the form of the wizard as a draft job while it is filled in. The address shows the draft
 * (`?entwurf=<id>`), so a reload brings it back. Saves run one after another, together with
 * everything else that saves the draft (`exclusive`), so there is never a second draft.
 */
export function useDraftAutosave({ state, worthKeeping, initial, save }: Options) {
  const [draftId, setDraftId] = useState(initial?.draftId ?? null);
  const [savedAt, setSavedAt] = useState(initial?.savedAt ?? null);
  const [failed, setFailed] = useState(false);
  const serialized = JSON.stringify(state);
  const idRef = useRef(draftId);
  const lastSaved = useRef<string | null>(initial ? serialized : null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const closed = useRef(false);

  const adopt = useCallback((id: string | null) => {
    if (id === idRef.current) return;
    idRef.current = id;
    setDraftId(id);
    // Next.js keeps its router in step with the native history.
    window.history.replaceState(null, '', id ? `${NEW_JOB}?entwurf=${id}` : NEW_JOB);
  }, []);

  /** Runs `task` after every save before it, with the id of the draft as it is then. */
  const exclusive = useCallback(<T>(task: (id: string | null) => Promise<T>): Promise<T> => {
    const result = queue.current.then(() => task(idRef.current));
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  /** Something else saved the draft with this form, e.g. the test run. */
  const markSaved = useCallback(
    (sent: WizardState, id: string | null) => {
      adopt(id);
      lastSaved.current = JSON.stringify(sent);
      setSavedAt(new Date().toISOString());
      setFailed(false);
    },
    [adopt],
  );

  /** While the test is created from the draft, nothing saves the draft. */
  const pause = useCallback((paused: boolean) => {
    closed.current = paused;
  }, []);

  useEffect(() => {
    if (!worthKeeping && idRef.current === null) return;
    if (serialized === lastSaved.current) return;
    const timer = setTimeout(() => {
      void exclusive(async (id) => {
        if (closed.current || serialized === lastSaved.current) return;
        try {
          const result = await save(id, JSON.parse(serialized) as WizardState);
          if (closed.current) return;
          adopt(result.draftId);
          if (result.savedAt) {
            lastSaved.current = serialized;
            setSavedAt(result.savedAt);
          }
          setFailed(false);
        } catch {
          // Offline or the server failed: the next change tries again.
          setFailed(true);
        }
      });
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [serialized, worthKeeping, exclusive, adopt, save]);

  return { draftId, savedAt, failed, exclusive, adopt, markSaved, pause };
}
