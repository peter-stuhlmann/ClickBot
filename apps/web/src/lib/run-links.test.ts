import { describe, expect, it } from 'vitest';
import { testRunHref } from './run-links';

describe('testRunHref', () => {
  it('opens the report of the start when several devices or browsers ran', () => {
    expect(testRunHref({ runId: 'a', runIds: ['a', 'b', 'c'] })).toBe('/laeufe/welle/a');
  });

  it('opens the report of the run when it ran alone', () => {
    expect(testRunHref({ runId: 'a', runIds: ['a'] })).toBe('/laeufe/a');
  });
});
