import { describe, expect, it } from 'vitest';
import { createGa4Recorder, parseGa4Events } from './analytics';

const collect = 'https://region1.google-analytics.com/g/collect?v=2&tid=G-TEST';

describe('parseGa4Events', () => {
  it('reads the event name from the URL', () => {
    expect(parseGa4Events(`${collect}&en=page_view`, null)).toEqual(['page_view']);
  });

  it('reads batched events from the request body, one hit per line', () => {
    expect(parseGa4Events(collect, 'en=scroll&ep.x=1\nen=generate_lead\n')).toEqual([
      'scroll',
      'generate_lead',
    ]);
  });

  it('combines URL and body events', () => {
    expect(parseGa4Events(`${collect}&en=page_view`, 'en=click')).toEqual(['page_view', 'click']);
  });

  it('decodes encoded event names', () => {
    expect(parseGa4Events(`${collect}&en=form%20start`, null)).toEqual(['form start']);
  });

  it.each([
    'https://www.google-analytics.com/g/collect?en=x',
    'https://analytics.google.com/g/collect?en=x',
  ])('accepts the GA4 host %s', (url) => {
    expect(parseGa4Events(url, null)).toEqual(['x']);
  });

  it.each([
    'https://beispiel.de/g/collect?en=fake',
    'https://region1.google-analytics.com/collect?en=ua',
    'https://evil-google-analytics.com/g/collect?en=x',
  ])('ignores %s', (url) => {
    expect(parseGa4Events(url, null)).toEqual([]);
  });
});

describe('createGa4Recorder', () => {
  it('resolves immediately for an event that was already recorded', async () => {
    const recorder = createGa4Recorder();
    recorder.record(`${collect}&en=page_view`, null);
    await expect(recorder.waitFor('page_view', 1)).resolves.toBe(true);
  });

  it('resolves as soon as the event arrives', async () => {
    const recorder = createGa4Recorder();
    const waiting = recorder.waitFor('generate_lead', 1_000);
    recorder.record(`${collect}&en=generate_lead`, null);
    await expect(waiting).resolves.toBe(true);
  });

  it('keeps waiting when a different event arrives', async () => {
    const recorder = createGa4Recorder();
    const waiting = recorder.waitFor('generate_lead', 30);
    recorder.record(`${collect}&en=scroll`, null);
    await expect(waiting).resolves.toBe(false);
  });

  it('resolves false after the timeout and keeps all events in order', async () => {
    const recorder = createGa4Recorder();
    recorder.record(`${collect}&en=page_view`, null);
    await expect(recorder.waitFor('generate_lead', 20)).resolves.toBe(false);
    expect(recorder.events()).toEqual(['page_view']);
  });
});
