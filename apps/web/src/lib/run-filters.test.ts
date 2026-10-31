import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUN_FILTERS,
  describePage,
  pageHref,
  parseRunFilters,
  toRunQuery,
} from './run-filters';

const now = new Date('2026-11-05T12:30:00Z');

describe('parseRunFilters', () => {
  it('starts with the last 7 days of all customers, results and devices', () => {
    expect(parseRunFilters({})).toEqual({
      kampagne: '',
      ergebnis: '',
      zeitraum: '7d',
      geraet: '',
      seite: 1,
    });
    expect(parseRunFilters({})).toEqual(DEFAULT_RUN_FILTERS);
  });

  it('reads the filters from the address', () => {
    expect(
      parseRunFilters({
        kampagne: 'c1',
        ergebnis: 'fehlgeschlagen',
        zeitraum: '24h',
        geraet: 'iphone',
        seite: '3',
      }),
    ).toEqual({
      kampagne: 'c1',
      ergebnis: 'fehlgeschlagen',
      zeitraum: '24h',
      geraet: 'iphone',
      seite: 3,
    });
  });

  it('ignores values it does not know, so a broken link still shows something', () => {
    expect(
      parseRunFilters({ ergebnis: 'super', zeitraum: '1j', geraet: 'toaster', seite: '-2' }),
    ).toEqual(DEFAULT_RUN_FILTERS);
    expect(parseRunFilters({ seite: 'zwei' }).seite).toBe(1);
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parseRunFilters({ ergebnis: ['offen', 'fehlgeschlagen'] }).ergebnis).toBe('offen');
  });
});

describe('toRunQuery', () => {
  it('turns the filters into a query for listRuns', () => {
    expect(
      toRunQuery(
        { kampagne: 'c1', ergebnis: 'offen', zeitraum: '24h', geraet: 'android', seite: 3 },
        now,
      ),
    ).toEqual({
      campaignId: 'c1',
      statuses: ['queued', 'running'],
      since: new Date('2026-11-04T12:30:00Z'),
      device: 'android',
      limit: 50,
      offset: 100,
    });
  });

  it('leaves out what is not filtered', () => {
    expect(toRunQuery({ ...DEFAULT_RUN_FILTERS, zeitraum: 'alle' }, now)).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it.each([
    ['erfolgreich', ['passed']],
    ['hinweis', ['warning']],
    ['fehlgeschlagen', ['failed']],
    ['abgebrochen', ['cancelled']],
  ] as const)('maps the result %s', (ergebnis, statuses) => {
    expect(toRunQuery({ ...DEFAULT_RUN_FILTERS, ergebnis }, now).statuses).toEqual(statuses);
  });

  it('looks back 30 days', () => {
    expect(toRunQuery({ ...DEFAULT_RUN_FILTERS, zeitraum: '30d' }, now).since).toEqual(
      new Date('2026-10-06T12:30:00Z'),
    );
  });
});

describe('pageHref', () => {
  it('keeps the filters and leaves out the defaults', () => {
    expect(pageHref({ ...DEFAULT_RUN_FILTERS, kampagne: 'c1', ergebnis: 'hinweis' }, 2)).toBe(
      '/laeufe?kampagne=c1&ergebnis=hinweis&seite=2',
    );
    expect(pageHref(DEFAULT_RUN_FILTERS, 1)).toBe('/laeufe');
    expect(pageHref({ ...DEFAULT_RUN_FILTERS, zeitraum: 'alle', geraet: 'ipad' }, 1)).toBe(
      '/laeufe?zeitraum=alle&geraet=ipad',
    );
  });
});

describe('describePage', () => {
  it.each([
    [1_240, 1, '1–50 von 1.240 · neueste zuerst'],
    [1_240, 25, '1.201–1.240 von 1.240 · neueste zuerst'],
    [7, 1, '7 Durchläufe · neueste zuerst'],
    [1, 1, '1 Durchlauf'],
    [0, 1, 'keine Durchläufe'],
  ])('%d runs, page %d → %s', (total, page, text) => {
    expect(describePage(total, page)).toBe(text);
  });
});
