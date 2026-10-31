import { describe, expect, it } from 'vitest';
import {
  browserErrors,
  addSlot,
  describeRunTotal,
  emptyDraft,
  errorsByPath,
  newStep,
  normaliseUrl,
  rhythmOf,
  stepsForAiTask,
  scheduleErrors,
  stepErrors,
  summarise,
  suggestName,
  describeAdvanced,
  WIZARD_STEPS,
  withStartUrl,
  toNewJobInput,
  toStep,
  validateWizardStep,
  wizardStepOf,
  type StepDraft,
  type WizardDraft,
} from './job-draft';

// 13:30 in Berlin.
const now = new Date('2026-11-05T12:30:00Z');

function draft(overrides: Partial<WizardDraft> = {}): WizardDraft {
  return {
    ...emptyDraft(now),
    campaignId: 'campaign-1',
    startUrl: 'https://beispiel.de/kontakt',
    name: 'Kontaktformular-Test',
    confirmed: true,
    ...overrides,
  };
}

function step(type: StepDraft['type'], overrides: Partial<StepDraft> = {}): StepDraft {
  return { ...newStep(type, [], ''), ...overrides };
}

const paths = (issues: { path: string }[]) => issues.map((issue) => issue.path);

describe('emptyDraft', () => {
  it('starts on desktop with an hourly interval from now and one slot at the next full hour', () => {
    const fresh = emptyDraft(now);
    expect(fresh.devices).toEqual(['desktop']);
    expect(fresh.deviceBrowsers).toEqual({ desktop: ['chromium'] });
    expect(fresh.steps).toEqual([]);
    expect(fresh.schedule).toMatchObject({
      type: 'interval',
      rhythm: 'hourly',
      everyMinutes: '60',
      maxRuns: '24',
      startMode: 'now',
      stagger: true,
    });
    expect(fresh.schedule.slots).toEqual([
      { key: 'slot-1', date: '2026-11-05', time: '14:00', bots: 1 },
    ]);
  });

  it('rolls the first slot over to the next day shortly before midnight', () => {
    const lateEvening = new Date('2026-11-05T22:40:00Z'); // 23:40 Berlin
    expect(emptyDraft(lateEvening).schedule.slots[0]).toMatchObject({
      date: '2026-11-06',
      time: '00:00',
    });
  });
});

describe('normaliseUrl', () => {
  it.each([
    ['beispiel.de/kontakt', 'https://beispiel.de/kontakt'],
    ['  https://beispiel.de  ', 'https://beispiel.de'],
    ['http://127.0.0.1:4100/kontakt.html', 'http://127.0.0.1:4100/kontakt.html'],
    ['', ''],
  ])('turns %j into %j', (input, expected) => {
    expect(normaliseUrl(input)).toBe(expected);
  });
});

describe('newStep', () => {
  it('opens the start URL as the first step', () => {
    expect(newStep('open', [], 'beispiel.de/kontakt')).toMatchObject({
      id: 'open-1',
      type: 'open',
      url: 'https://beispiel.de/kontakt',
    });
  });

  it('gives every step an id that is not taken yet', () => {
    const existing = [step('click', { id: 'click-1' }), step('click', { id: 'click-3' })];
    expect(newStep('click', existing, '').id).toBe('click-4');
  });

  it('suggests a sensible way to find the element', () => {
    expect(newStep('click', [], '')).toMatchObject({ targetBy: 'role', targetRole: 'button' });
    expect(newStep('fill', [], '')).toMatchObject({ targetBy: 'label' });
  });

  it('turns the goal of a free test into one AI step after opening the start page', () => {
    const steps = stepsForAiTask('beispiel.de/blog', '  Hinterlasse einen Test-Kommentar. ');
    expect(steps.map((s) => [s.id, s.type, s.url, s.value])).toEqual([
      ['open-1', 'open', 'https://beispiel.de/blog', ''],
      ['ai-1', 'ai', '', '  Hinterlasse einen Test-Kommentar. '],
    ]);
    expect(toStep(steps[1] as StepDraft)).toMatchObject({
      type: 'ai',
      instruction: 'Hinterlasse einen Test-Kommentar.',
    });
  });

  it('scrolls a new scroll step on from where the page stands, a bit down', () => {
    expect(toStep(newStep('scroll', [], ''))).toMatchObject({
      to: { kind: 'by', direction: 'down', distance: 500 },
    });
  });

  it('leaves out the position from the left while it is empty', () => {
    const position = step('scroll', { scrollKind: 'position', scrollY: '900', scrollX: ' ' });
    expect(toStep(position)).toMatchObject({ to: { kind: 'position', y: 900 } });
    expect(toStep({ ...position, scrollX: '40' })).toMatchObject({
      to: { kind: 'position', y: 900, x: 40 },
    });
  });
});

describe('toNewJobInput', () => {
  it('builds flow, schedule and devices for createJob', () => {
    const input = toNewJobInput(
      draft({
        startUrl: 'beispiel.de/kontakt',
        name: '  Kontaktformular-Test ',
        devices: ['desktop', 'iphone'],
        // Android was chosen and switched off again: its browsers stay in the draft only.
        deviceBrowsers: { desktop: ['chromium', 'firefox'], android: ['firefox'] },
        steps: [
          step('open', { id: 'open-1', url: 'https://beispiel.de/kontakt' }),
          step('fill', {
            id: 'fill-1',
            targetBy: 'label',
            targetValue: 'E-Mail',
            value: '{{faker.email}}',
            timeoutSeconds: '2,5',
          }),
          step('click', { id: 'click-1', targetRole: 'button', targetValue: 'Absenden' }),
          step('assert', { id: 'assert-1', value: 'Vielen Dank' }),
        ],
      }),
      now,
    );

    expect(input).toMatchObject({
      campaignId: 'campaign-1',
      name: 'Kontaktformular-Test',
      startUrl: 'https://beispiel.de/kontakt',
      devices: ['desktop', 'iphone'],
      deviceBrowsers: { desktop: ['chromium', 'firefox'], iphone: ['webkit'] },
      status: 'active',
      schedule: {
        type: 'interval',
        everyMinutes: 60,
        maxRuns: 24,
        startAt: '2026-11-05T12:30:00.000Z',
      },
    });
    expect(input.flow).toEqual({
      version: 1,
      steps: [
        { id: 'open-1', type: 'open', url: 'https://beispiel.de/kontakt', timeoutMs: 10_000 },
        {
          id: 'fill-1',
          type: 'fill',
          target: { by: 'label', label: 'E-Mail' },
          value: '{{faker.email}}',
          timeoutMs: 2_500,
        },
        {
          id: 'click-1',
          type: 'click',
          target: { by: 'role', role: 'button', name: 'Absenden' },
          timeoutMs: 10_000,
        },
        {
          id: 'assert-1',
          type: 'assert',
          assertion: { kind: 'textVisible', text: 'Vielen Dank' },
          timeoutMs: 10_000,
        },
      ],
    });
  });

  it.each([
    [
      { targetBy: 'role', targetRole: 'link', targetValue: '' },
      { by: 'role', role: 'link' },
    ],
    [
      { targetBy: 'text', targetValue: 'Kontakt' },
      { by: 'text', text: 'Kontakt' },
    ],
    [
      { targetBy: 'css', targetValue: '#send' },
      { by: 'css', selector: '#send' },
    ],
    [
      { targetBy: 'testId', targetValue: 'send' },
      { by: 'testId', testId: 'send' },
    ],
  ] as const)('finds an element by %j', (fields, target) => {
    const [built] = toNewJobInput(draft({ steps: [step('click', fields)] }), now).flow.steps;
    expect(built).toMatchObject({ target });
  });

  it.each([
    [
      { assertKind: 'urlContains', value: '/danke' },
      { kind: 'urlContains', value: '/danke' },
    ],
    [
      { assertKind: 'titleContains', value: 'Danke' },
      { kind: 'titleContains', value: 'Danke' },
    ],
    [
      { assertKind: 'elementVisible', targetBy: 'testId', targetValue: 'ok' },
      { kind: 'elementVisible', target: { by: 'testId', testId: 'ok' } },
    ],
  ] as const)('checks %j', (fields, assertion) => {
    const [built] = toNewJobInput(draft({ steps: [step('assert', fields)] }), now).flow.steps;
    expect(built).toMatchObject({ assertion });
  });

  it('builds the remaining step types', () => {
    const steps = toNewJobInput(
      draft({
        steps: [
          step('select', { targetBy: 'label', targetValue: 'Land', value: 'Österreich' }),
          step('wait', { waitKind: 'duration', waitSeconds: '1,5' }),
          step('wait', { waitKind: 'element', targetBy: 'text', targetValue: 'Fertig' }),
          step('wait', { waitKind: 'networkIdle' }),
          step('screenshot', { value: 'Danke-Seite', fullPage: true }),
          step('screenshot', { value: '  ' }),
          step('analytics', { value: 'form_submit' }),
        ],
      }),
      now,
    ).flow.steps;

    expect(steps.map(({ id: _id, timeoutMs: _t, ...rest }) => rest)).toEqual([
      { type: 'select', target: { by: 'label', label: 'Land' }, option: 'Österreich' },
      { type: 'wait', until: { kind: 'duration', ms: 1_500 } },
      { type: 'wait', until: { kind: 'element', target: { by: 'text', text: 'Fertig' } } },
      { type: 'wait', until: { kind: 'networkIdle' } },
      { type: 'screenshot', name: 'Danke-Seite', fullPage: true },
      { type: 'screenshot', fullPage: false },
      { type: 'analytics', provider: 'ga4', event: 'form_submit' },
    ]);
  });

  it('converts slots in Berlin time and staggers bots by 10 seconds', () => {
    const fresh = emptyDraft(now);
    const input = toNewJobInput(
      draft({
        schedule: {
          ...fresh.schedule,
          type: 'times',
          slots: [{ key: 'slot-1', date: '2026-11-05', time: '14:00', bots: 3 }],
        },
      }),
      now,
    );
    expect(input.schedule).toEqual({
      type: 'times',
      slots: [{ date: '2026-11-05', time: '14:00', bots: 3 }],
      staggerSeconds: 10,
      timezone: 'Europe/Berlin',
    });
  });

  it('starts an interval at a chosen Berlin time', () => {
    const fresh = emptyDraft(now);
    const input = toNewJobInput(
      draft({
        schedule: {
          ...fresh.schedule,
          startMode: 'at',
          startDate: '2026-11-06',
          startTime: '09:00',
        },
      }),
      now,
    );
    expect(input.schedule).toMatchObject({ startAt: '2026-11-06T08:00:00.000Z' });
  });
});

describe('validateWizardStep', () => {
  it('accepts a complete last step', () => {
    expect(validateWizardStep(draft(), 'devices', now)).toEqual([]);
  });

  it('asks for campaign and name in the last step, with the devices', () => {
    const issues = validateWizardStep(
      draft({ campaignId: '', name: ' ', startUrl: '', confirmed: true }),
      'devices',
      now,
    );
    expect(issues).toEqual([
      { path: 'campaignId', message: 'Bitte eine Kampagne wählen.' },
      { path: 'name', message: 'Name fehlt.' },
    ]);
  });

  it('needs the start address together with the flow', () => {
    expect(validateWizardStep(draft({ startUrl: 'ftp://x' }), 'test', now)).toContainEqual({
      path: 'startUrl',
      message: 'Die Adresse muss mit http:// oder https:// beginnen.',
    });
  });

  it('accepts a start URL without scheme, because https:// is added', () => {
    const steps = [step('open', { url: 'https://beispiel.de' })];
    expect(validateWizardStep(draft({ startUrl: 'beispiel.de', steps }), 'test', now)).toEqual([]);
  });

  it('needs the confirmation that testing is allowed before the job is created', () => {
    expect(validateWizardStep(draft({ confirmed: false }), 'devices', now)).toEqual([
      { path: 'confirmed', message: 'Bitte bestätigen, dass ihr diese Website testen dürft.' },
    ]);
  });

  it('reports flow problems with paths to the step fields', () => {
    const issues = validateWizardStep(
      draft({ steps: [step('open', { url: 'kontakt' }), step('click', { targetValue: '' })] }),
      'test',
      now,
    );
    expect(paths(issues)).toEqual(['flow.steps.0.url']);
  });

  it('asks for at least one step', () => {
    expect(validateWizardStep(draft({ steps: [] }), 'test', now)).toEqual([
      { path: 'flow.steps', message: 'Der Ablauf braucht mindestens einen Schritt.' },
    ]);
  });

  it('rejects a start or a slot in the past', () => {
    const fresh = emptyDraft(now);
    const pastStart = draft({
      schedule: { ...fresh.schedule, startMode: 'at', startDate: '2026-11-05', startTime: '13:00' },
    });
    expect(validateWizardStep(pastStart, 'schedule', now)).toEqual([
      { path: 'schedule.startAt', message: 'Der Start liegt in der Vergangenheit.' },
    ]);

    const pastSlot = draft({
      schedule: {
        ...fresh.schedule,
        type: 'times',
        slots: [
          { key: 'slot-1', date: '2026-11-05', time: '13:00', bots: 1 },
          { key: 'slot-2', date: '2026-11-05', time: '15:00', bots: 1 },
        ],
      },
    });
    expect(validateWizardStep(pastSlot, 'schedule', now)).toEqual([
      { path: 'schedule.slots.0.time', message: 'Der Termin liegt in der Vergangenheit.' },
    ]);
  });

  it('reports an invalid start date instead of a past one', () => {
    const fresh = emptyDraft(now);
    const issues = validateWizardStep(
      draft({ schedule: { ...fresh.schedule, startMode: 'at', startDate: '', startTime: '' } }),
      'schedule',
      now,
    );
    expect(issues).toEqual([{ path: 'schedule.startAt', message: 'Ungültiger Startzeitpunkt.' }]);
  });

  it('reports numbers that are not numbers', () => {
    const fresh = emptyDraft(now);
    const issues = validateWizardStep(
      draft({
        schedule: { ...fresh.schedule, rhythm: 'custom', everyMinutes: '', maxRuns: 'viele' },
      }),
      'schedule',
      now,
    );
    expect(paths(issues)).toEqual(['schedule.everyMinutes', 'schedule.maxRuns']);
  });

  it('turns the rhythm into minutes, and "once" into a single run', () => {
    const fresh = emptyDraft(now);
    const scheduleOf = (patch: Partial<typeof fresh.schedule>) =>
      toNewJobInput(draft({ schedule: { ...fresh.schedule, ...patch } }), now).schedule;
    expect(scheduleOf({ rhythm: 'hourly', everyMinutes: '7' })).toMatchObject({
      everyMinutes: 60,
      maxRuns: 24,
    });
    expect(scheduleOf({ rhythm: 'daily' })).toMatchObject({ everyMinutes: 1440 });
    expect(scheduleOf({ rhythm: 'once', maxRuns: '' })).toMatchObject({ maxRuns: 1 });
    expect(scheduleOf({ rhythm: 'custom', everyMinutes: '7' })).toMatchObject({ everyMinutes: 7 });
  });

  it('shows a stored interval as the rhythm it matches', () => {
    expect(rhythmOf(60, 24)).toBe('hourly');
    expect(rhythmOf(1440, 3)).toBe('daily');
    expect(rhythmOf(60, 1)).toBe('once');
    expect(rhythmOf(15, 20)).toBe('custom');
  });

  it('needs at least one device', () => {
    expect(validateWizardStep(draft({ devices: [] }), 'devices', now)).toEqual([
      { path: 'devices', message: 'Mindestens ein Gerät wählen.' },
    ]);
  });

  it('needs a browser for every chosen device, said at the device', () => {
    expect(
      validateWizardStep(
        draft({ devices: ['desktop', 'android'], deviceBrowsers: { desktop: [] } }),
        'devices',
        now,
      ),
    ).toEqual([
      { path: 'deviceBrowsers.desktop', message: 'Mindestens einen Browser wählen.' },
      { path: 'deviceBrowsers.android', message: 'Mindestens einen Browser wählen.' },
    ]);
    expect(
      validateWizardStep(
        draft({ devices: ['android'], deviceBrowsers: { android: ['webkit'] } }),
        'devices',
        now,
      ),
    ).toEqual([
      { path: 'deviceBrowsers.android', message: 'Android gibt es nur mit Chrome oder Firefox.' },
    ]);
  });

  it('sorts browser problems by device for the device cards', () => {
    expect(
      browserErrors([
        { path: 'deviceBrowsers.android', message: 'Mindestens einen Browser wählen.' },
        { path: 'deviceBrowsers.android', message: 'zweite Meldung' },
        { path: 'devices', message: 'Mindestens ein Gerät wählen.' },
        { path: 'deviceBrowsers', message: 'Unbekanntes Gerät.' },
      ]),
    ).toEqual({ android: 'Mindestens einen Browser wählen.' });
  });
});

describe('withStartUrl', () => {
  it('starts the flow with opening the start address', () => {
    const changed = withStartUrl(draft({ startUrl: '', steps: [] }), 'beispiel.de');
    expect(changed.startUrl).toBe('beispiel.de');
    expect(changed.steps).toMatchObject([{ type: 'open', url: 'https://beispiel.de' }]);
  });

  it('keeps the first step in line with the start address while typing', () => {
    const empty = draft({ startUrl: '', steps: [] });
    const first = withStartUrl(empty, 'beisp');
    const next = withStartUrl({ ...empty, ...first }, 'beispiel.de');
    expect(next.steps).toHaveLength(1);
    expect(next.steps[0]).toMatchObject({ id: first.steps[0]?.id, url: 'https://beispiel.de' });
  });

  it('leaves a first step alone that was changed by hand', () => {
    const steps = [step('open', { url: '/kontakt' }), step('click')];
    const changed = withStartUrl(draft({ startUrl: 'beispiel.de', steps }), 'beispiel.de/neu');
    expect(changed.steps).toBe(steps);
  });
});

describe('stepErrors', () => {
  it('maps the paths of a step to the fields of the step form', () => {
    const issues = [
      { path: 'flow.steps.1.url', message: 'A' },
      { path: 'flow.steps.1.target.label', message: 'B' },
      { path: 'flow.steps.1.assertion.text', message: 'C' },
      { path: 'flow.steps.1.until.ms', message: 'D' },
      { path: 'flow.steps.1.timeoutMs', message: 'E' },
      { path: 'flow.steps.1.target.role', message: 'F' },
      { path: 'flow.steps.1.id', message: 'G' },
      { path: 'flow.steps.1.username', message: 'H' },
      { path: 'flow.steps.1.password', message: 'I' },
      { path: 'flow.steps.2.url', message: 'other step' },
    ];
    expect(stepErrors(issues, 1)).toEqual({
      username: 'H',
      password: 'I',
      url: 'A',
      targetValue: 'B',
      value: 'C',
      waitSeconds: 'D',
      timeoutSeconds: 'E',
      targetRole: 'F',
      general: 'G',
    });
  });

  it('keeps the first message per field', () => {
    const issues = [
      { path: 'flow.steps.0.assertion.target.label', message: 'first' },
      { path: 'flow.steps.0.until.target.text', message: 'second' },
    ];
    expect(stepErrors(issues, 0)).toEqual({ targetValue: 'first' });
  });

  it('maps the fields of scroll and key steps', () => {
    const issues = [
      { path: 'flow.steps.0.to.y', message: 'Ganze Pixel ab 0.' },
      { path: 'flow.steps.0.to.target.name', message: 'Bitte ausfüllen.' },
      { path: 'flow.steps.1.key', message: 'Eine Taste wie „Escape“.' },
      { path: 'flow.steps.2.to.x', message: 'Ganze Pixel ab 0.' },
      { path: 'flow.steps.3.to.distance', message: 'Ganze Pixel ab 1.' },
    ];
    expect(stepErrors(issues, 0)).toEqual({
      scrollY: 'Ganze Pixel ab 0.',
      targetValue: 'Bitte ausfüllen.',
    });
    expect(stepErrors(issues, 1)).toEqual({ key: 'Eine Taste wie „Escape“.' });
    expect(stepErrors(issues, 2)).toEqual({ scrollX: 'Ganze Pixel ab 0.' });
    expect(stepErrors(issues, 3)).toEqual({ scrollDistance: 'Ganze Pixel ab 1.' });
  });
});

describe('wizard steps', () => {
  it('has three: the website with the test, when, and devices with the name', () => {
    expect(WIZARD_STEPS.map((step) => step.key)).toEqual(['test', 'schedule', 'devices']);
  });

  it('sends every problem to the step that shows its field', () => {
    expect(wizardStepOf('startUrl')).toBe('test');
    expect(wizardStepOf('flow.steps.1.target.name')).toBe('test');
    expect(wizardStepOf('schedule.slots.0.time')).toBe('schedule');
    expect(wizardStepOf('devices')).toBe('devices');
    expect(wizardStepOf('deviceBrowsers.android')).toBe('devices');
    expect(wizardStepOf('name')).toBe('devices');
    expect(wizardStepOf('campaignId')).toBe('devices');
    expect(wizardStepOf('confirmed')).toBe('devices');
  });

  it('checks website and flow in the first step, name and campaign in the last', () => {
    const fresh = emptyDraft(now);
    expect(validateWizardStep(fresh, 'test', now).map((issue) => issue.path)).toEqual([
      'startUrl',
      'flow.steps',
    ]);
    expect(validateWizardStep(fresh, 'devices', now).map((issue) => issue.path)).toEqual([
      'campaignId',
      'name',
      'confirmed',
    ]);
  });
});

describe('suggestName', () => {
  it('takes the first sentence of the goal of a free test', () => {
    const steps = stepsForAiTask(
      'beispiel.de',
      'Es gibt ein Kontaktformular. Es lässt sich absenden.',
    );
    expect(suggestName(draft({ steps }))).toBe('Es gibt ein Kontaktformular');
  });

  it('shortens a long goal at a word', () => {
    const goal =
      'Auf der Startseite gibt es einen blauen Button mit der Aufschrift Newsletter abonnieren und daneben ein Feld';
    const name = suggestName(draft({ steps: stepsForAiTask('beispiel.de', goal) }));
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name).toMatch(/…$/);
    expect(name).not.toMatch(/ …$/);
  });

  it('names a fixed flow after the website', () => {
    expect(suggestName(draft({ startUrl: 'https://www.beispiel.de/kontakt', steps: [] }))).toBe(
      'Test auf beispiel.de',
    );
    expect(suggestName(draft({ startUrl: '', steps: [] }))).toBe('');
  });
});

describe('describeAdvanced', () => {
  it('says nothing is changed while the defaults hold', () => {
    expect(describeAdvanced(emptyDraft(now))).toEqual({
      summary: 'GA4-Markierung an · Werbung blockiert',
      changed: false,
    });
  });

  it('names what was switched off', () => {
    const all = { debugMode: false, internalTraffic: false, botFlag: false, runNumber: false };
    expect(describeAdvanced(draft({ analyticsMarking: all, blockAds: false }))).toEqual({
      summary: 'GA4-Markierung aus · Werbung erlaubt',
      changed: true,
    });
  });
});

describe('scheduleErrors', () => {
  it('collects one message per slot row and the interval fields', () => {
    const errors = scheduleErrors([
      { path: 'schedule.everyMinutes', message: 'A' },
      { path: 'schedule.startAt', message: 'B' },
      { path: 'schedule.slots', message: 'C' },
      { path: 'schedule.slots.1', message: 'Doppelt' },
      { path: 'schedule.slots.2.bots', message: 'Browser' },
      { path: 'schedule.slots.2.time', message: 'ignored, row has a message' },
      { path: 'flow.steps', message: 'not a schedule issue' },
    ]);
    expect(errors).toEqual({
      fields: { everyMinutes: 'A', startAt: 'B', slots: 'C' },
      slots: { 1: 'Doppelt', 2: 'Browser' },
    });
  });
});

describe('summarise', () => {
  const campaigns = [{ id: 'campaign-1', name: 'Black Friday' }];

  it('shows dashes for what is not decided yet, and no technical rows while they are default', () => {
    expect(summarise(emptyDraft(now), campaigns, now)).toEqual([
      { label: 'Website', value: '–' },
      { label: 'Test', value: '–' },
      { label: 'Zeitplan', value: 'jede Stunde · 24-mal' },
      { label: 'Geräte', value: 'Desktop (Chrome)' },
      { label: 'Name', value: '–' },
    ]);
  });

  it('names the campaign only when the project has several', () => {
    const two = [...campaigns, { id: 'campaign-2', name: 'Sommer' }];
    const rows = summarise(draft({ campaignId: 'campaign-2' }), two, now);
    expect(rows.at(-1)).toEqual({ label: 'Kampagne', value: 'Sommer' });
    expect(summarise(draft(), campaigns, now).some((row) => row.label === 'Kampagne')).toBe(false);
  });

  it('describes a free test by its mode, and shows changed technical settings', () => {
    const free = draft({
      steps: stepsForAiTask('beispiel.de', 'Es gibt ein Kontaktformular.'),
      blockAds: false,
      analyticsMarking: { debugMode: false, internalTraffic: true, botFlag: true, runNumber: true },
    });
    const rows = summarise(free, campaigns, now);
    expect(rows.find((row) => row.label === 'Test')).toEqual({
      label: 'Test',
      value: 'Frei mit KI',
    });
    expect(rows.find((row) => row.label === 'Erweitert')).toEqual({
      label: 'Erweitert',
      value: 'GA4-Markierung aus: Debug-Modus · Werbung erlaubt',
    });
  });

  it('summarises a complete draft', () => {
    const fresh = emptyDraft(now);
    const rows = summarise(
      draft({
        startUrl: 'beispiel.de/kontakt',
        steps: [step('open'), step('click')],
        devices: ['desktop', 'iphone'],
        schedule: {
          ...fresh.schedule,
          type: 'times',
          slots: [
            { key: 'slot-1', date: '2026-11-05', time: '14:00', bots: 3 },
            { key: 'slot-2', date: '2026-11-05', time: '15:00', bots: 7 },
          ],
        },
      }),
      campaigns,
      now,
    );
    expect(rows).toEqual([
      { label: 'Website', value: 'beispiel.de/kontakt' },
      { label: 'Test', value: 'Fester Ablauf · 2 Schritte' },
      { label: 'Zeitplan', value: '2 Termine · 10 Browser' },
      { label: 'Geräte', value: 'Desktop (Chrome), iPhone 15 (Safari)' },
      { label: 'Name', value: 'Kontaktformular-Test' },
    ]);
  });

  it('shows a dash for a schedule that is not valid yet', () => {
    const fresh = emptyDraft(now);
    const rows = summarise(
      draft({ schedule: { ...fresh.schedule, rhythm: 'custom', everyMinutes: '' } }),
      campaigns,
      now,
    );
    expect(rows.find((row) => row.label === 'Zeitplan')?.value).toBe('–');
  });
});

describe('describeRunTotal', () => {
  it('multiplies the starts of the schedule by the devices', () => {
    expect(describeRunTotal(draft({ devices: ['desktop', 'iphone'] }), now)).toBe(
      '24 Starts × 2 Geräte = 48 Durchläufe',
    );
    const fresh = emptyDraft(now);
    const oneSlot = draft({ schedule: { ...fresh.schedule, type: 'times' } });
    expect(describeRunTotal(oneSlot, now)).toBe('1 Start × 1 Gerät = 1 Durchlauf');
  });

  it('counts every device in each of its browsers, iPhone once in Safari', () => {
    expect(
      describeRunTotal(
        draft({
          devices: ['desktop', 'iphone'],
          deviceBrowsers: { desktop: ['chromium', 'firefox'] },
        }),
        now,
      ),
    ).toBe('24 Starts × 3 Kombinationen = 72 Durchläufe');
  });

  it('says nothing while the schedule is invalid or no device is chosen', () => {
    const fresh = emptyDraft(now);
    expect(
      describeRunTotal(draft({ schedule: { ...fresh.schedule, maxRuns: '' } }), now),
    ).toBeNull();
    expect(describeRunTotal(draft({ devices: [] }), now)).toBeNull();
    expect(describeRunTotal(draft({ deviceBrowsers: { desktop: [] } }), now)).toBeNull();
  });
});

describe('errorsByPath', () => {
  it('keeps the first message per path', () => {
    expect(
      errorsByPath([
        { path: 'name', message: 'first' },
        { path: 'name', message: 'second' },
        { path: 'startUrl', message: 'url' },
      ]),
    ).toEqual({ name: 'first', startUrl: 'url' });
  });
});

describe('addSlot', () => {
  it('adds a slot one hour after the last one, with a new key', () => {
    const slots = [{ key: 'slot-1', date: '2026-11-05', time: '13:24', bots: 3 }];
    expect(addSlot(slots)).toEqual([
      ...slots,
      { key: 'slot-2', date: '2026-11-05', time: '14:24', bots: 1 },
    ]);
  });

  it('rolls over to the next day', () => {
    const slots = [{ key: 'slot-4', date: '2026-12-31', time: '23:30', bots: 1 }];
    expect(addSlot(slots)[1]).toEqual({
      key: 'slot-5',
      date: '2027-01-01',
      time: '00:30',
      bots: 1,
    });
  });

  it('copies date and time of a last slot that is not filled in yet', () => {
    const slots = [{ key: 'slot-1', date: '', time: '', bots: 1 }];
    expect(addSlot(slots)[1]).toMatchObject({ date: '', time: '' });
  });
});

describe('GA4 marking in the wizard', () => {
  it('starts with every marking on and sends it to createJob', () => {
    expect(emptyDraft(now).analyticsMarking).toEqual({
      debugMode: true,
      internalTraffic: true,
      botFlag: true,
      runNumber: true,
    });
    const marking = { debugMode: false, internalTraffic: true, botFlag: true, runNumber: false };
    expect(toNewJobInput(draft({ analyticsMarking: marking }), now).analyticsMarking).toEqual(
      marking,
    );
  });

  it('names what is switched off in the summary', () => {
    const rows = summarise(
      draft({
        analyticsMarking: {
          debugMode: false,
          internalTraffic: true,
          botFlag: true,
          runNumber: true,
        },
      }),
      [],
      now,
    );
    expect(rows.find((row) => row.label === 'Erweitert')).toEqual({
      label: 'Erweitert',
      value: 'GA4-Markierung aus: Debug-Modus',
    });
  });
});

describe('ads in the wizard', () => {
  it('blocks ads by default and sends the choice to createJob', () => {
    expect(emptyDraft(now).blockAds).toBe(true);
    expect(toNewJobInput(draft(), now).blockAds).toBe(true);
    expect(toNewJobInput(draft({ blockAds: false }), now).blockAds).toBe(false);
  });

  it('says in the summary when ads are allowed, nothing while they are blocked', () => {
    const value = (blockAds: boolean) =>
      summarise(draft({ blockAds }), [], now).find((row) => row.label === 'Erweitert')?.value;
    expect(value(true)).toBeUndefined();
    expect(value(false)).toBe('Werbung erlaubt');
  });
});

describe('.htaccess steps in the wizard', () => {
  it('need a user name and a password', () => {
    const issues = validateWizardStep(draft({ steps: [step('basicAuth')] }), 'test', now);
    expect(issues).toEqual([
      { path: 'flow.steps.0.username', message: 'Bitte ausfüllen.' },
      { path: 'flow.steps.0.password', message: 'Bitte ausfüllen.' },
    ]);
  });

  it('send user name and password to the server, which stores the password encrypted', () => {
    const auth = step('basicAuth', { username: ' kunde ', password: 'geheim 123' });
    expect(toNewJobInput(draft({ steps: [auth] }), now).flow.steps[0]).toMatchObject({
      type: 'basicAuth',
      username: 'kunde',
      // Spaces may belong to a password: sent exactly as typed.
      password: 'geheim 123',
    });
  });
});

describe('random plans in the wizard', () => {
  const random = (overrides: Partial<WizardDraft['schedule']> = {}) =>
    draft({ schedule: { ...emptyDraft(now).schedule, type: 'random', ...overrides } });

  it('starts with a week from today, 50 runs, even curves on every day and a seed', () => {
    const { schedule } = emptyDraft(now);
    expect(schedule).toMatchObject({
      randomFrom: '2026-11-05',
      randomTo: '2026-11-11',
      randomRuns: '50',
    });
    expect(Object.keys(schedule.curves)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(schedule.curves.mon).toEqual(Array.from({ length: 25 }, () => 1));
    expect(Number.isInteger(schedule.seed)).toBe(true);
  });

  it('builds a random plan that draws from now on', () => {
    expect(toNewJobInput(random({ randomRuns: '120' }), now).schedule).toMatchObject({
      type: 'random',
      from: '2026-11-05',
      to: '2026-11-11',
      runs: 120,
      drawFrom: now.toISOString(),
      timezone: 'Europe/Berlin',
    });
  });

  it('says what is wrong with the period and the number of runs', () => {
    const issues = validateWizardStep(
      random({ randomFrom: '2026-11-10', randomTo: '2026-11-09', randomRuns: '0' }),
      'schedule',
      now,
    );
    expect(scheduleErrors(issues).fields).toMatchObject({
      to: 'Das Ende liegt vor dem Start.',
      runs: 'Bitte eine ganze Zahl zwischen 1 und 10.000 eingeben.',
    });
  });

  it('counts the runs of a random plan for every device', () => {
    expect(describeRunTotal(random({ randomRuns: '30' }), now)).toBe(
      '30 Starts × 1 Gerät = 30 Durchläufe',
    );
  });
});
