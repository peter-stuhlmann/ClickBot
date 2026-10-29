// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analysisNotice, toPageFactRows } from './flow-suggestion-view';

describe('toPageFactRows', () => {
  it('lists what the worker found on the page, as on "Auf der Seite erkannt"', () => {
    expect(
      toPageFactRows({
        url: 'https://beispiel.de/kontakt',
        title: 'Kontakt',
        snapshot: '',
        forms: 1,
        requiredFields: 4,
        cookieBanner: 'Usercentrics',
        ga4: ['G-8K2ABC', 'G-OTHER1'],
      }),
    ).toEqual([
      { label: 'Seite', value: 'Kontakt' },
      { label: 'Formulare', value: '1' },
      { label: 'Pflichtfelder', value: '4' },
      { label: 'Cookie-Banner', value: 'Usercentrics' },
      { label: 'Analytics', value: 'GA4 · G-8K2ABC, G-OTHER1' },
    ]);
  });

  it('says plainly what it did not find', () => {
    const rows = toPageFactRows({
      url: 'https://beispiel.de',
      title: '',
      snapshot: '',
      forms: 0,
      requiredFields: 0,
      cookieBanner: null,
      ga4: [],
    });
    expect(rows).toEqual([
      { label: 'Seite', value: 'beispiel.de' },
      { label: 'Formulare', value: 'keine' },
      { label: 'Pflichtfelder', value: 'keine' },
      { label: 'Cookie-Banner', value: 'keins erkannt' },
      { label: 'Analytics', value: 'kein GA4 gefunden' },
    ]);
  });
});

describe('analysisNotice', () => {
  it.each([
    [{ kind: 'offline' } as const, 'Der Worker ist offline, deshalb kennt die KI die Seite nicht.'],
    [
      { kind: 'failed', error: 'Seite ist passwortgeschützt (HTTP 401).' } as const,
      'Die Seite ließ sich nicht öffnen: Seite ist passwortgeschützt (HTTP 401).',
    ],
    [{ kind: 'timeout' } as const, 'Die Seite wurde nicht rechtzeitig geöffnet.'],
  ])('explains why the model did not know the page', (outcome, start) => {
    const notice = analysisNotice(outcome);
    expect(notice.startsWith(start)).toBe(true);
    expect(notice).toContain('Bitte die Beschriftungen in den Schritten genau prüfen.');
  });
});
