import type { Flow, Schedule } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import {
  appendStep,
  jobToDraft,
  moveStep,
  newStep,
  removeStep,
  toJobUpdateInput,
  validateJobEdit,
  type StepDraft,
  type WizardDraft,
} from './job-draft';

// 13:30 in Berlin.
const now = new Date('2026-11-05T12:30:00Z');

const base = { timeoutMs: 10_000, aiFallback: true };
const flow: Flow = {
  version: 1,
  steps: [
    { ...base, id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' },
    {
      ...base,
      id: 'send',
      type: 'click',
      target: { by: 'role', role: 'button', name: 'Absenden' },
    },
  ],
};

const interval: Schedule = {
  type: 'interval',
  everyMinutes: 15,
  maxRuns: 20,
  // Seconds and milliseconds, as saved by the wizard with "start now".
  startAt: '2026-11-05T09:00:31.250Z',
};

const times: Schedule = {
  type: 'times',
  slots: [
    { date: '2026-11-05', time: '11:00', bots: 3 },
    { date: '2026-11-05', time: '15:00', bots: 1 },
  ],
  staggerSeconds: 5,
  timezone: 'Europe/Berlin',
};

const job = (overrides: Partial<Parameters<typeof jobToDraft>[0]> = {}) => ({
  customerId: 'customer-1',
  name: 'Kontaktformular-Test',
  startUrl: 'https://beispiel.de/kontakt',
  flow,
  schedule: interval,
  devices: ['desktop', 'iphone'] as const,
  browsers: ['firefox'] as const,
  analyticsMarking: { debugMode: false, internalTraffic: true, botFlag: true, runNumber: true },
  ...overrides,
});

function draftOf(input = job()): WizardDraft {
  const loaded = jobToDraft(input, now);
  if (!('draft' in loaded)) throw new Error(loaded.notEditable);
  return loaded.draft;
}

describe('jobToDraft', () => {
  it('fills the forms with the stored job', () => {
    const draft = draftOf();
    expect(draft).toMatchObject({
      customerId: 'customer-1',
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de/kontakt',
      confirmed: true,
      devices: ['desktop', 'iphone'],
      browsers: ['firefox'],
    });
    expect(draft.steps.map((step) => [step.id, step.type])).toEqual([
      ['open', 'open'],
      ['send', 'click'],
    ]);
    // 09:00:31 UTC is 10:00 in Berlin.
    expect(draft.schedule).toMatchObject({
      type: 'interval',
      everyMinutes: '15',
      maxRuns: '20',
      startMode: 'at',
      startDate: '2026-11-05',
      startTime: '10:00',
    });
  });

  it('loads dates with their bots and keeps the stagger of the job', () => {
    const draft = draftOf(job({ schedule: times }));
    expect(draft.schedule).toMatchObject({
      type: 'times',
      slots: [
        { key: 'slot-1', date: '2026-11-05', time: '11:00', bots: 3 },
        { key: 'slot-2', date: '2026-11-05', time: '15:00', bots: 1 },
      ],
      stagger: true,
      staggerSeconds: 5,
    });
  });

  it('refuses flows with steps the forms cannot show, so saving cannot drop them', () => {
    const withAi = job({
      flow: {
        version: 1,
        steps: [...flow.steps, { ...base, id: 'ai', type: 'ai', instruction: 'Banner schließen' }],
      },
    });
    expect(jobToDraft(withAi, now)).toEqual({
      notEditable:
        'Der Ablauf enthält Schritte, die der Editor noch nicht kann (Auslesen, KI oder Code).',
    });
  });

  it('refuses dates in another time zone', () => {
    expect(jobToDraft(job({ schedule: { ...times, timezone: 'America/New_York' } }), now)).toEqual({
      notEditable:
        'Der Zeitplan nutzt die Zeitzone America/New_York, der Editor kennt nur Europe/Berlin.',
    });
  });
});

describe('toJobUpdateInput', () => {
  it('saves an untouched job exactly as it was', () => {
    const input = toJobUpdateInput(draftOf(), now);
    expect(input).toEqual({
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de/kontakt',
      flow: {
        version: 1,
        steps: [
          { id: 'open', type: 'open', url: 'https://beispiel.de/kontakt', timeoutMs: 10_000 },
          {
            id: 'send',
            type: 'click',
            target: { by: 'role', role: 'button', name: 'Absenden' },
            timeoutMs: 10_000,
          },
        ],
      },
      // The exact stored start, not 10:00:00: the starts must not move by merely saving.
      schedule: { type: 'interval', everyMinutes: 15, maxRuns: 20, startAt: interval.startAt },
      devices: ['desktop', 'iphone'],
      browsers: ['firefox'],
      // The job's own GA4 marking, not the default.
      analyticsMarking: { debugMode: false, internalTraffic: true, botFlag: true, runNumber: true },
    });

    expect(toJobUpdateInput(draftOf(job({ schedule: times })), now).schedule).toEqual(times);
  });

  it('uses a newly chosen start time', () => {
    const draft = draftOf();
    draft.schedule = { ...draft.schedule, startTime: '11:00' };
    expect(toJobUpdateInput(draft, now).schedule).toMatchObject({
      startAt: '2026-11-05T10:00:00.000Z',
    });
  });

  it('turns staggering off and on again with the stored distance', () => {
    const draft = draftOf(job({ schedule: times }));
    draft.schedule = { ...draft.schedule, stagger: false };
    expect(toJobUpdateInput(draft, now).schedule).toMatchObject({ staggerSeconds: 0 });
    draft.schedule = { ...draft.schedule, stagger: true };
    expect(toJobUpdateInput(draft, now).schedule).toMatchObject({ staggerSeconds: 5 });
  });
});

describe('validateJobEdit', () => {
  it('accepts a job whose start and dates lie in the past, as long as they are unchanged', () => {
    const original = draftOf(job({ schedule: times }));
    expect(validateJobEdit(structuredClone(original), original, now)).toEqual([]);

    const intervalJob = draftOf();
    expect(validateJobEdit(structuredClone(intervalJob), intervalJob, now)).toEqual([]);
  });

  it('rejects a new or moved date in the past', () => {
    const original = draftOf(job({ schedule: times }));
    const edited = structuredClone(original);
    edited.schedule.slots[1] = { key: 'slot-2', date: '2026-11-05', time: '12:00', bots: 1 };
    expect(validateJobEdit(edited, original, now)).toEqual([
      { path: 'schedule.slots.1.time', message: 'Der Termin liegt in der Vergangenheit.' },
    ]);
  });

  it('rejects an interval start moved into the past', () => {
    const original = draftOf();
    const edited = structuredClone(original);
    edited.schedule.startTime = '09:00';
    expect(validateJobEdit(edited, original, now)).toEqual([
      { path: 'schedule.startAt', message: 'Der Start liegt in der Vergangenheit.' },
    ]);
  });

  it('checks name, address, flow and devices like the wizard', () => {
    const original = draftOf();
    const edited = { ...structuredClone(original), name: ' ', steps: [], devices: [] };
    expect(validateJobEdit(edited, original, now).map((issue) => issue.path)).toEqual([
      'name',
      'flow.steps',
      'devices',
    ]);
  });
});

describe('step list helpers', () => {
  const steps = (): StepDraft[] => [
    newStep('open', [], 'https://beispiel.de'),
    { ...newStep('click', [], ''), id: 'click-1' },
    { ...newStep('fill', [], ''), id: 'fill-1' },
  ];

  it('appends a click step and selects it', () => {
    const result = appendStep(steps(), 'https://beispiel.de');
    expect(result.steps.map((step) => step.id)).toEqual(['open-1', 'click-1', 'fill-1', 'click-2']);
    expect(result.selected).toBe(3);
  });

  it('starts an empty flow by opening the start URL', () => {
    expect(appendStep([], 'beispiel.de').steps[0]).toMatchObject({
      type: 'open',
      url: 'https://beispiel.de',
    });
  });

  it('moves a step and keeps it selected', () => {
    const result = moveStep(steps(), 2, -1);
    expect(result.steps.map((step) => step.id)).toEqual(['open-1', 'fill-1', 'click-1']);
    expect(result.selected).toBe(1);
  });

  it('ignores a move past either end', () => {
    expect(moveStep(steps(), 0, -1).steps.map((step) => step.id)).toEqual([
      'open-1',
      'click-1',
      'fill-1',
    ]);
    expect(moveStep(steps(), 2, 1).selected).toBe(2);
  });

  it.each([
    // [removed, selected before, selected after]
    [1, 2, 1],
    [1, 0, 0],
    [2, 2, 1],
    [0, null, null],
  ] as const)('removes step %d with %s selected → %s', (index, selected, expected) => {
    const result = removeStep(steps(), index, selected);
    expect(result.steps).toHaveLength(2);
    expect(result.selected).toBe(expected);
  });

  it('selects nothing once the last step is gone', () => {
    expect(removeStep([newStep('open', [], '')], 0, 0)).toEqual({ steps: [], selected: null });
  });
});
