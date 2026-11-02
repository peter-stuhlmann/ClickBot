import { describe, expect, it } from 'vitest';
import {
  INITIAL_WATCH,
  describeWatch,
  parseWatchMessage,
  watchReducer,
  type RunWatchState,
} from './run-watch';

const json = (value: unknown) => JSON.stringify(value);

describe('parseWatchMessage', () => {
  it.each([
    [{ type: 'waiting' }],
    [{ type: 'frame', data: 'abc' }],
    [{ type: 'hidden' }],
    [{ type: 'step', index: 2, total: 5, status: 'running' }],
    [{ type: 'ended', status: 'failed' }],
    [{ type: 'error', message: 'Diesen Durchlauf gibt es nicht.' }],
  ])('reads %j', (message) => {
    expect(parseWatchMessage(json(message))).toEqual(message);
  });

  it.each([
    'kaputt',
    json(null),
    json({ type: 'evaluate' }),
    json({ type: 'frame' }),
    json({ type: 'step', index: '2', total: 5, status: 'running' }),
    json({ type: 'step', index: 2, total: 5, status: 'gehackt' }),
    json({ type: 'ended' }),
    json({ type: 'error' }),
  ])('ignores %s', (raw) => {
    expect(parseWatchMessage(raw)).toBeNull();
  });
});

describe('watchReducer', () => {
  const apply = (...messages: Parameters<typeof watchReducer>[1][]) =>
    messages.reduce<RunWatchState>(watchReducer, INITIAL_WATCH);

  it('shows the newest frame and the step going on', () => {
    expect(
      apply(
        { type: 'waiting' },
        { type: 'frame', data: 'eins' },
        { type: 'step', index: 0, total: 3, status: 'running' },
        { type: 'frame', data: 'zwei' },
      ),
    ).toEqual({
      status: 'live',
      frame: 'data:image/jpeg;base64,zwei',
      step: { index: 0, total: 3, status: 'running' },
      message: null,
    });
  });

  it('drops the picture while the page shows a secret, until a new frame comes', () => {
    const hidden = apply({ type: 'frame', data: 'eins' }, { type: 'hidden' });
    expect(hidden).toMatchObject({ status: 'hidden', frame: null });
    expect(watchReducer(hidden, { type: 'frame', data: 'zwei' })).toMatchObject({
      status: 'live',
      frame: 'data:image/jpeg;base64,zwei',
    });
  });

  it('keeps the last picture when the run ends, and says why it stopped otherwise', () => {
    expect(
      apply({ type: 'frame', data: 'eins' }, { type: 'ended', status: 'passed' }),
    ).toMatchObject({ status: 'ended', frame: 'data:image/jpeg;base64,eins' });
    expect(apply({ type: 'error', message: 'Weg.' })).toMatchObject({
      status: 'error',
      message: 'Weg.',
    });
    // A lost connection after the end changes nothing.
    const ended = apply({ type: 'ended', status: 'passed' });
    expect(watchReducer(ended, { type: 'closed' })).toBe(ended);
    expect(apply({ type: 'closed' })).toMatchObject({
      status: 'error',
      message: 'Die Verbindung zum Testsystem ist abgebrochen.',
    });
  });
});

describe('describeWatch', () => {
  const titles = ['Öffne beispiel.de', 'Klicke auf „Kurse“', 'Prüfe „Danke“'];
  const apply = (...messages: Parameters<typeof watchReducer>[1][]) =>
    messages.reduce<RunWatchState>(watchReducer, INITIAL_WATCH);

  it('names the step going on, and what the picture cannot show', () => {
    expect(describeWatch(INITIAL_WATCH, titles)).toEqual({
      caption: null,
      overlay: 'Verbinde mit dem Testsystem …',
    });
    expect(
      describeWatch(
        apply(
          { type: 'frame', data: 'x' },
          { type: 'step', index: 1, total: 3, status: 'running' },
        ),
        titles,
      ),
    ).toEqual({ caption: 'Schritt 2 von 3 · Klicke auf „Kurse“', overlay: null });
    expect(describeWatch(apply({ type: 'waiting' }), titles).overlay).toBe(
      'Wartet auf einen freien Browser …',
    );
    expect(describeWatch(apply({ type: 'hidden' }), titles).overlay).toBe(
      'Ausgeblendet: Die Seite zeigt gerade Zugangsdaten.',
    );
    expect(
      describeWatch(
        apply(
          { type: 'step', index: 4, total: 5, status: 'passed' },
          { type: 'ended', status: 'passed' },
        ),
        titles,
      ),
    ).toEqual({ caption: 'Schritt 5 von 5', overlay: 'Noch kein Bild.' });
    expect(describeWatch(apply({ type: 'error', message: 'Weg.' }), titles).overlay).toBe('Weg.');
  });
});
