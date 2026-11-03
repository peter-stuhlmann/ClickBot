import { describe, expect, it } from 'vitest';
import { toWebVtt, vttTime } from './video-captions';

const titles = ['Öffne beispiel.de', 'Klicke auf „Absenden“', 'Prüfe: „Danke“ ist sichtbar'];

describe('vttTime', () => {
  it.each([
    [0, '00:00:00.000'],
    [1_234, '00:00:01.234'],
    [61_005, '00:01:01.005'],
    [3_723_400, '01:02:03.400'],
  ])('writes %d ms as %s', (ms, text) => {
    expect(vttTime(ms)).toBe(text);
  });
});

describe('toWebVtt', () => {
  it('names each step as the report does, with its place in the flow', () => {
    expect(
      toWebVtt(
        [
          { step: 0, from: 0, to: 1_200 },
          { step: 1, from: 1_200, to: 2_000 },
        ],
        titles,
      ),
    ).toBe(
      [
        'WEBVTT',
        '',
        '00:00:00.000 --> 00:00:01.200',
        'Schritt 1 von 3 · Öffne beispiel.de',
        '',
        '00:00:01.200 --> 00:00:02.000',
        'Schritt 2 von 3 · Klicke auf „Absenden“',
        '',
      ].join('\n'),
    );
  });

  it('says when the picture was hidden, and stays readable for unknown steps', () => {
    const vtt = toWebVtt(
      [
        { step: null, from: 500, to: 900 },
        { step: 7, from: 900, to: 900 },
      ],
      titles,
    );
    expect(vtt).toContain(
      '00:00:00.500 --> 00:00:00.900\nAusgeblendet: Die Seite zeigte Zugangsdaten.',
    );
    // A cue needs some length to be shown.
    expect(vtt).toContain('00:00:00.900 --> 00:00:01.000\nSchritt 8 von 3');
  });

  it('keeps a title from breaking the format: no "-->" and no empty lines', () => {
    const vtt = toWebVtt([{ step: 0, from: 0, to: 100 }], ['Prüfe -->\n\nböse']);
    expect(vtt).toContain('Schritt 1 von 1 · Prüfe → böse');
  });
});
