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
    [{ key: 'Escape' }, { type: 'key', key: 'Escape' }],
    [
      { key: 'Tab', shiftKey: true },
      { type: 'key', key: 'Shift+Tab' },
    ],
    [
      { key: 'a', ctrlKey: true },
      { type: 'key', key: 'Control+a' },
    ],
    [
      { key: 'K', ctrlKey: true, shiftKey: true },
      { type: 'key', key: 'Control+Shift+K' },
    ],
    [
      { key: 'ArrowLeft', altKey: true },
      { type: 'key', key: 'Alt+ArrowLeft' },
    ],
  ])('sends %o', (event, input) => {
    expect(
      keyInput({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...event }),
    ).toEqual(input);
  });

  it.each([
    // Copy and paste stay in the own browser; pasting sends the text instead.
    { key: 'c', ctrlKey: true },
    { key: 'v', metaKey: true },
    { key: 'x', ctrlKey: true },
    { key: 'F12' },
    { key: 'Shift' },
    { key: 'Control', ctrlKey: true },
  ])('leaves these keys to the own browser: %o', (event) => {
    expect(
      keyInput({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...event }),
    ).toBeNull();
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
    // Only browsing was dropped: everything is recorded now.
    expect(parseLiveMessage('{"type":"mode","mode":"browse"}')).toBeNull();
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

  it('takes keys, scrolling and photos from the live browser', () => {
    let steps: RecordedDraft[] = [];
    steps = addRecordedStep(steps, { type: 'press', key: 'Escape' });
    steps = addRecordedStep(steps, { type: 'scroll', to: { kind: 'position', y: 900 } });
    steps = addRecordedStep(steps, { type: 'screenshot' });
    expect(steps.map((step) => [step.type, step.key || step.scrollY])).toEqual([
      ['press', 'Escape'],
      ['scroll', '900'],
      ['screenshot', '0'],
    ]);
  });

  it('keeps one scroll step while scrolling goes on, where the page came to rest', () => {
    let steps: RecordedDraft[] = [];
    steps = addRecordedStep(steps, { type: 'scroll', to: { kind: 'position', y: 900 } });
    steps = addRecordedStep(steps, { type: 'scroll', to: { kind: 'position', y: 1800 } });
    expect(steps.map((step) => [step.id, step.scrollY])).toEqual([['aufnahme-1', '1800']]);
  });

  it('ignores a step it cannot show', () => {
    expect(addRecordedStep([], { type: 'open', url: 'ftp://beispiel.de' })).toEqual([]);
  });
});
