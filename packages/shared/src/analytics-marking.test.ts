import { describe, expect, it } from 'vitest';
import {
  ALL_MARKINGS_ON,
  analyticsMarkingSchema,
  describeMarking,
  markingState,
} from './analytics-marking';

describe('analyticsMarkingSchema', () => {
  it('marks everything when a job says nothing', () => {
    expect(analyticsMarkingSchema.parse(undefined)).toEqual(ALL_MARKINGS_ON);
    expect(analyticsMarkingSchema.parse({})).toEqual(ALL_MARKINGS_ON);
  });

  it('keeps what was switched off', () => {
    expect(analyticsMarkingSchema.parse({ debugMode: false })).toEqual({
      ...ALL_MARKINGS_ON,
      debugMode: false,
    });
  });

  it('accepts only switches', () => {
    expect(analyticsMarkingSchema.safeParse({ debugMode: 'nein' }).success).toBe(false);
    expect(analyticsMarkingSchema.safeParse({ extra: true }).success).toBe(false);
  });
});

describe('markingState', () => {
  it('tells whether all, some or none of the markings are on', () => {
    expect(markingState(ALL_MARKINGS_ON)).toBe('on');
    expect(markingState({ ...ALL_MARKINGS_ON, runNumber: false })).toBe('partial');
    expect(
      markingState({ debugMode: false, internalTraffic: false, botFlag: false, runNumber: false }),
    ).toBe('off');
  });
});

describe('describeMarking', () => {
  it('names nothing while everything is on', () => {
    expect(describeMarking(ALL_MARKINGS_ON)).toBeNull();
  });

  it('names what was off, for the report', () => {
    expect(describeMarking({ ...ALL_MARKINGS_ON, debugMode: false, internalTraffic: false })).toBe(
      'Aus: Debug-Modus, Interner Traffic',
    );
    expect(
      describeMarking({
        debugMode: false,
        internalTraffic: false,
        botFlag: false,
        runNumber: false,
      }),
    ).toBe('Aus: alle Markierungen');
  });
});
