import { describe, expect, it } from 'vitest';
import {
  addRecordedStep,
  keyInput,
  parseLiveMessage,
  toViewport,
  type RecordedDraft,
} from './live-recording';

const VIEWPORT = { width: 1280, height: 800 };

describe('toViewport', () => {
  it('maps a click on the scaled-down stream to the live browser', () => {
    const shown = { left: 100, top: 50, width: 640, height: 400 };
    expect(toViewport(420, 250, shown, VIEWPORT)).toEqual({ x: 640, y: 400 });
  });

  it('stays inside the live browser at the edges', () => {
    const shown = { left: 0, top: 0, width: 640, height: 400 };
    expect(toViewport(-5, 999, shown, VIEWPORT)).toEqual({ x: 0, y: 800 });
  });
});

describe('keyInput', () => {
  it.each([
    [{ key: 'a' }, { type: 'text', text: 'a' }],
    [{ key: 'Ä' }, { type: 'text', text: 'Ä' }],
    [{ key: ' ' }, { type: 'text', text: ' ' }],
    [{ key: 'Enter' }, { type: 'key', key: 'Enter' }],
    [{ key: 'Backspace' }, { type: 'key', key: 'Backspace' }],
    [{ key: 'ArrowDown' }, { type: 'key', key: 'ArrowDown' }],
  ])('sends %o', (event, input) => {
    expect(keyInput({ ctrlKey: false, metaKey: false, altKey: false, ...event })).toEqual(input);
  });

  it.each([
    { key: 'c', ctrlKey: true, metaKey: false, altKey: false },
    { key: 'v', ctrlKey: false, metaKey: true, altKey: false },
    { key: 'F12', ctrlKey: false, metaKey: false, altKey: false },
    { key: 'Shift', ctrlKey: false, metaKey: false, altKey: false },
  ])('leaves shortcuts and other keys to the own browser: %o', (event) => {
    expect(keyInput(event)).toBeNull();
  });
});

describe('parseLiveMessage', () => {
  it('reads the messages of the live browser', () => {
    expect(parseLiveMessage('{"type":"url","url":"https://beispiel.de"}')).toEqual({
      type: 'url',
      url: 'https://beispiel.de',
    });
    expect(parseLiveMessage('{"type":"frame","data":"abc"}')).toEqual({
      type: 'frame',
      data: 'abc',
    });
  });

  it('ignores what it does not understand', () => {
    expect(parseLiveMessage('kaputt')).toBeNull();
    expect(parseLiveMessage('{"type":"unbekannt"}')).toBeNull();
    expect(parseLiveMessage('{"type":"step","step":{"type":"code","source":"x"}}')).toBeNull();
  });
});

describe('addRecordedStep', () => {
  const fill = (value: string, label = 'Name') => ({
    type: 'fill',
    target: { by: 'label', label },
    value,
  });

  it('adds recorded steps as editable drafts with their own ids', () => {
    let steps: RecordedDraft[] = [];
    steps = addRecordedStep(steps, { type: 'open', url: 'https://beispiel.de' });
    steps = addRecordedStep(steps, {
      type: 'click',
      target: { by: 'role', role: 'button', name: 'Absenden' },
    });
    expect(steps.map((step) => [step.id, step.type])).toEqual([
      ['aufnahme-1', 'open'],
      ['aufnahme-2', 'click'],
    ]);
    expect(steps[1]).toMatchObject({
      targetBy: 'role',
      targetRole: 'button',
      targetValue: 'Absenden',
    });
  });

  it('keeps only the last value when the same field is filled again right away', () => {
    let steps: RecordedDraft[] = [];
    steps = addRecordedStep(steps, fill('Len'));
    steps = addRecordedStep(steps, fill('Lena'));
    steps = addRecordedStep(steps, fill('lena@example.org', 'E-Mail'));
    expect(steps.map((step) => step.value)).toEqual(['Lena', 'lena@example.org']);
  });

  it('ignores a step it cannot show', () => {
    expect(addRecordedStep([], { type: 'open', url: 'ftp://beispiel.de' })).toEqual([]);
  });
});
