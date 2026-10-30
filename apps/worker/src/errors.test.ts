import { describe, expect, it } from 'vitest';
import { StepError, formatSeconds, refusedCredentials, toStepMessage } from './errors';

describe('formatSeconds', () => {
  it.each([
    [300, '0,3 s'],
    [10_000, '10 s'],
    [1_250, '1,3 s'],
  ])('formats %i ms as %s', (ms, text) => {
    expect(formatSeconds(ms)).toBe(text);
  });
});

describe('toStepMessage', () => {
  it('keeps the message of a StepError', () => {
    expect(toStepMessage(new StepError('Seite antwortet mit HTTP 500.'))).toBe(
      'Seite antwortet mit HTTP 500.',
    );
  });

  it('reduces other errors to their first line, without call logs', () => {
    expect(toStepMessage(new Error('locator.fill: kaputt\nCall log:\n  - waiting'))).toBe(
      'locator.fill: kaputt',
    );
  });

  it('handles thrown non-errors and empty messages', () => {
    expect(toStepMessage('Text statt Error')).toBe('Text statt Error');
    expect(toStepMessage(new Error(''))).toBe('Unbekannter Fehler.');
  });
});

describe('refusedCredentials', () => {
  it('recognises a password page the full Chromium gave up on', () => {
    expect(
      refusedCredentials(new Error('page.goto: net::ERR_INVALID_AUTH_CREDENTIALS at http://x/')),
    ).toBe(true);
    expect(refusedCredentials(new Error('page.goto: net::ERR_CONNECTION_REFUSED'))).toBe(false);
    expect(refusedCredentials('ERR_INVALID_AUTH_CREDENTIALS')).toBe(false);
  });
});
