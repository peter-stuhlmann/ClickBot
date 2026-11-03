'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addRecordedStep,
  parseLiveMessage,
  type LiveViewport,
  type RecordedDraft,
} from '@/lib/live-recording';
import type { LiveInput, LiveMode, RecordingDevice, StartRecordingAction } from '@/lib/views';

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'ended';

const NO_CONNECTION = 'Keine Verbindung zum Live-Browser. Läuft das Testsystem?';

/**
 * The connection to the live browser of "Im Browser aufnehmen": asks the server for a one-time
 * token, connects to the worker and collects frames, address and recorded steps.
 */
export function useLiveRecording(startAction: StartRecordingAction) {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [frame, setFrame] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [viewport, setViewport] = useState<LiveViewport>({ width: 1280, height: 800 });
  const [mode, setMode] = useState<LiveMode>('record');
  const [error, setError] = useState<string>();
  const [steps, setSteps] = useState<RecordedDraft[]>([]);
  // The device of the last start, for "Neu verbinden" and what the steps were recorded on.
  const [device, setDevice] = useState<RecordingDevice>('desktop');
  const socket = useRef<WebSocket | null>(null);

  const close = useCallback(() => {
    const current = socket.current;
    socket.current = null;
    current?.close();
  }, []);

  // Leaving the page ends the live browser on the server as well.
  useEffect(() => close, [close]);

  async function start(startUrl: string, keepSteps = false, on: RecordingDevice = device) {
    close();
    setDevice(on);
    setError(undefined);
    setFrame(null);
    setMode('record');
    if (!keepSteps) setSteps([]);
    setStatus('connecting');
    const result = await startAction(startUrl, on);
    if (!result.ok) {
      setError(result.message);
      setStatus(keepSteps ? 'ended' : 'idle');
      return;
    }
    const ws = new WebSocket(result.url);
    socket.current = ws;
    ws.onmessage = (event) => {
      const message = parseLiveMessage(String(event.data));
      if (!message) return;
      switch (message.type) {
        case 'ready':
          setViewport(message.viewport);
          setUrl(message.url);
          setStatus('live');
          return;
        case 'frame':
          setFrame(`data:image/jpeg;base64,${message.data}`);
          return;
        case 'url':
          setUrl(message.url);
          return;
        case 'step':
          setSteps((old) => addRecordedStep(old, message.step));
          return;
        case 'mode':
          setMode(message.mode);
          return;
        case 'error':
          setError(message.message);
          return;
      }
    };
    ws.onerror = () => setError(NO_CONNECTION);
    ws.onclose = () => {
      if (socket.current !== ws) return;
      socket.current = null;
      setStatus('ended');
    };
  }

  function send(input: LiveInput) {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (input.type === 'mode') setMode(input.mode);
    ws.send(JSON.stringify(input));
  }

  /** Closes the live browser; the recorded steps stay until the next start. */
  function stop() {
    close();
    setStatus('idle');
    setFrame(null);
  }

  return {
    status,
    frame,
    url,
    viewport,
    device,
    mode,
    error,
    steps,
    start,
    send,
    stop,
    removeStep: (index: number) => setSteps((old) => old.filter((_, i) => i !== index)),
  };
}
