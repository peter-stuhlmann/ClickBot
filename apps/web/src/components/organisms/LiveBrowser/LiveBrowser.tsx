import { useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { StepItem } from '@/components/molecules/StepItem';
import { cn } from '@/lib/cn';
import { keyInput, toViewport, type LiveViewport } from '@/lib/live-recording';
import type { LiveInput, LiveMode, StepItemView } from '@/lib/views';

export type LiveBrowserProps = {
  /** idle: not started; connecting: waiting for the worker; live: streaming; ended: closed. */
  status: 'idle' | 'connecting' | 'live' | 'ended';
  /** The latest picture of the live browser as data URL. */
  frame: string | null;
  url: string;
  viewport: LiveViewport;
  mode: LiveMode;
  error?: string;
  steps: StepItemView[];
  onStart: () => void;
  onInput: (input: LiveInput) => void;
  onRemoveStep: (index: number) => void;
  /** Ends the recording and takes the steps over. */
  onFinish: () => void;
  onCancel: () => void;
};

const MODES = [
  { value: 'record', label: 'Aufnehmen' },
  { value: 'browse', label: 'Nur bedienen' },
] as const;
/** Hover menus need mouse moves; more than ten per second only cost bandwidth. */
const MOVE_INTERVAL_MS = 100;

const withScheme = (address: string) =>
  /^[a-z][a-z\d+.-]*:\/\//i.test(address.trim()) ? address.trim() : `https://${address.trim()}`;

/**
 * "Im Browser aufnehmen" (screen 04): the stream of the live browser on the server, which the
 * user operates with mouse and keyboard, next to the steps recorded so far.
 */
export function LiveBrowser({
  status,
  frame,
  url,
  viewport,
  mode,
  error,
  steps,
  onStart,
  onInput,
  onRemoveStep,
  onFinish,
  onCancel,
}: LiveBrowserProps) {
  const [address, setAddress] = useState(url);
  const [shownUrl, setShownUrl] = useState(url);
  const lastMove = useRef(0);
  // The address bar follows the page, like in a normal browser.
  if (url !== shownUrl) {
    setShownUrl(url);
    setAddress(url);
  }

  if (status === 'idle') {
    return (
      <Card
        title="Im Browser aufnehmen"
        description="Click-Bot öffnet die Start-URL in einem Browser auf dem Server. Du klickst dich durch, jeder Klick und jede Eingabe wird ein Schritt. Passwörter werden nie aufgezeichnet."
      >
        {error && <p className="text-small text-danger">{error}</p>}
        <div>
          <Button icon={<Icon name="record" size={16} />} onClick={onStart}>
            Aufnahme starten
          </Button>
        </div>
      </Card>
    );
  }

  const point = (event: MouseEvent<HTMLElement>) => {
    const shown = event.currentTarget.getBoundingClientRect();
    if (shown.width === 0 || shown.height === 0) return null;
    return toViewport(event.clientX, event.clientY, shown, viewport);
  };
  const count = steps.length;

  return (
    <>
      <Card title="Live-Browser">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Zurück"
              icon={<Icon name="arrowLeft" size={16} />}
              onClick={() => onInput({ type: 'back' })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Vor"
              icon={<Icon name="arrowRight" size={16} />}
              onClick={() => onInput({ type: 'forward' })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Neu laden"
              icon={<Icon name="reload" size={16} />}
              onClick={() => onInput({ type: 'reload' })}
            />
          </div>
          <form
            className="min-w-0 flex-1 basis-48"
            onSubmit={(event) => {
              event.preventDefault();
              if (address.trim()) onInput({ type: 'navigate', url: withScheme(address) });
            }}
          >
            <Input
              aria-label="Adresse"
              mono
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </form>
          <SegmentedControl
            label="Modus"
            options={MODES}
            value={mode === 'browse' ? 'browse' : 'record'}
            onChange={(next) => onInput({ type: 'mode', mode: next })}
          />
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={mode === 'assert'}
            icon={<Icon name="check" size={16} />}
            onClick={() => onInput({ type: 'mode', mode: mode === 'assert' ? 'record' : 'assert' })}
          >
            Prüfung hinzufügen
          </Button>
        </div>

        <div
          role="application"
          aria-label="Live-Browser"
          tabIndex={0}
          className={cn(
            'relative aspect-8/5 w-full cursor-pointer overflow-hidden overscroll-contain rounded-input border bg-subtle',
            'focus-visible:outline-2 focus-visible:outline-primary',
            mode === 'assert' ? 'border-primary' : 'border-border',
          )}
          onClick={(event) => {
            event.currentTarget.focus();
            const at = point(event);
            if (at) onInput({ type: 'click', ...at });
          }}
          onMouseMove={(event) => {
            if (event.timeStamp - lastMove.current < MOVE_INTERVAL_MS) return;
            lastMove.current = event.timeStamp;
            const at = point(event);
            if (at) onInput({ type: 'move', ...at });
          }}
          onWheel={(event) => onInput({ type: 'wheel', dx: event.deltaX, dy: event.deltaY })}
          onKeyDown={(event) => {
            const input = keyInput(event);
            if (!input) return;
            event.preventDefault();
            onInput(input);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text');
            if (text) onInput({ type: 'text', text });
          }}
        >
          {frame ? (
            // A live JPEG stream: next/image cannot optimise it, and the frames change constantly.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame} alt="" draggable={false} className="size-full select-none" />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center text-body text-text-muted">
              {status === 'connecting' ? 'Browser wird gestartet …' : 'Kein Bild.'}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-small text-text-muted">
          <span>
            {status === 'ended'
              ? 'Verbindung beendet'
              : `Live · Chromium auf dem Server · ${viewport.width} × ${viewport.height}`}
          </span>
          {status === 'ended' ? (
            <Button variant="secondary" size="sm" onClick={onStart}>
              Neu verbinden
            </Button>
          ) : (
            <span>
              {mode === 'assert'
                ? 'Der nächste Klick wird eine Prüfung.'
                : mode === 'browse'
                  ? 'Nur bedienen – nichts wird aufgezeichnet.'
                  : 'Klicks und Eingaben werden aufgezeichnet.'}
            </span>
          )}
        </div>
      </Card>

      <Card
        title="Aufgezeichnet"
        aside={
          <span className="shrink-0 text-meta text-text-muted">
            {count === 1 ? '1 Schritt' : `${count} Schritte`}
          </span>
        }
      >
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={`${index}-${step.title}`} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <StepItem index={index} step={step} selected={false} readOnly />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="px-1.5"
                aria-label={`Schritt ${index + 1} entfernen`}
                icon={<Icon name="trash" size={16} />}
                onClick={() => onRemoveStep(index)}
              />
            </li>
          ))}
        </ol>
        <p className="text-small text-text-muted">
          Mit „Prüfung hinzufügen“ wird der nächste Klick eine Prüfung, ob das Element sichtbar ist.
          Die Seite reagiert dann nicht auf diesen Klick.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Icon name="check" size={16} />} disabled={count === 0} onClick={onFinish}>
            {`Aufnahme beenden · ${count === 1 ? '1 Schritt' : `${count} Schritte`} übernehmen`}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </Card>
    </>
  );
}
