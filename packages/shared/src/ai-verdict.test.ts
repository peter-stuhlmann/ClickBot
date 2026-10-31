import { describe, expect, it } from 'vitest';
import { verdictOutcome, type Criterion } from './ai-verdict';

const c = (status: Criterion['status']): Criterion => ({
  goal: 'Ziel',
  status,
  evidence: 'Gesehen.',
});

describe('verdictOutcome', () => {
  it('passes only when every sub-goal is met', () => {
    expect(verdictOutcome([c('met'), c('met')])).toBe('passed');
  });

  it('fails as soon as one sub-goal is not met, even next to unknown ones', () => {
    expect(verdictOutcome([c('met'), c('unknown'), c('failed')])).toBe('failed');
  });

  it('is unclear when a sub-goal could not be checked', () => {
    expect(verdictOutcome([c('met'), c('unknown')])).toBe('unclear');
  });
});
