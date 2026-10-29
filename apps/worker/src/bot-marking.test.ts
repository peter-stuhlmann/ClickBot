import { describe, expect, it } from 'vitest';
import { ALL_MARKINGS_ON } from '@click-bot/shared';
import { isGa4CollectUrl, markGa4Url } from './bot-marking';

describe('isGa4CollectUrl', () => {
  it.each([
    ['https://www.google-analytics.com/g/collect?v=2&tid=G-ABC123', true],
    ['https://region1.google-analytics.com/g/collect?v=2&tid=G-ABC123', true],
    ['https://analytics.google.com/g/collect?v=2&tid=G-ABC123', true],
    // Server-side tagging on the customer's own domain.
    ['https://sgtm.beispiel.de/g/collect?v=2&tid=G-ABC123', true],
    ['https://beispiel.de/g/collect?v=2', false],
    ['https://beispiel.de/kontakt?tid=G-ABC123', false],
    ['https://www.google-analytics.com/collect?v=1&tid=UA-1', false],
    ['kein url', false],
  ])('%s → %s', (url, expected) => {
    expect(isGa4CollectUrl(url)).toBe(expected);
  });
});

describe('markGa4Url', () => {
  it('sends the request in debug mode, as internal traffic and with the run number', () => {
    const marked = new URL(
      markGa4Url(
        'https://region1.google-analytics.com/g/collect?v=2&tid=G-ABC123&en=page_view',
        7,
        ALL_MARKINGS_ON,
      ),
    );
    expect(Object.fromEntries(marked.searchParams)).toEqual({
      v: '2',
      tid: 'G-ABC123',
      en: 'page_view',
      _dbg: '1',
      'ep.traffic_type': 'internal',
      'ep.click_bot': '1',
      'epn.click_bot_run': '7',
    });
    expect(marked.origin + marked.pathname).toBe('https://region1.google-analytics.com/g/collect');
  });

  it('overrides what the website sets, so a bot run can never count as a real visit', () => {
    const marked = new URL(
      markGa4Url(
        'https://www.google-analytics.com/g/collect?tid=G-A&_dbg=0&ep.traffic_type=external',
        3,
        ALL_MARKINGS_ON,
      ),
    );
    expect(marked.searchParams.getAll('_dbg')).toEqual(['1']);
    expect(marked.searchParams.getAll('ep.traffic_type')).toEqual(['internal']);
  });

  it('sets only the markings the job has switched on, and leaves the rest to the website', () => {
    const marked = new URL(
      markGa4Url('https://www.google-analytics.com/g/collect?tid=G-A&_dbg=0', 5, {
        ...ALL_MARKINGS_ON,
        debugMode: false,
        runNumber: false,
      }),
    );
    expect(Object.fromEntries(marked.searchParams)).toEqual({
      tid: 'G-A',
      _dbg: '0',
      'ep.traffic_type': 'internal',
      'ep.click_bot': '1',
    });
  });
});
