import { describe, expect, it } from 'vitest';
import { flowSchema, stepSchema } from './flow';

const click = (id: string) => ({
  id,
  type: 'click',
  target: { by: 'role', role: 'button', name: 'Absenden' },
});

describe('stepSchema', () => {
  it('fills in defaults for timeout and AI fallback', () => {
    const step = stepSchema.parse(click('s1'));
    expect(step).toMatchObject({ timeoutMs: 10_000, aiFallback: true });
  });

  it('accepts every target strategy the editor offers', () => {
    const targets = [
      { by: 'role', role: 'link', name: 'Kontakt' },
      { by: 'label', label: 'E-Mail' },
      { by: 'text', text: 'Vielen Dank' },
      { by: 'css', selector: 'form#contact button' },
      { by: 'testId', testId: 'submit' },
    ];
    for (const target of targets) {
      expect(stepSchema.safeParse({ id: 's', type: 'click', target }).success).toBe(true);
    }
  });

  it('rejects a click without a target', () => {
    expect(stepSchema.safeParse({ id: 's1', type: 'click' }).success).toBe(false);
  });

  it('rejects an unknown step type', () => {
    expect(stepSchema.safeParse({ id: 's1', type: 'hover' }).success).toBe(false);
  });

  it.each([99, 120_001])('rejects timeout %i ms outside 100 ms – 120 s', (timeoutMs) => {
    expect(stepSchema.safeParse({ ...click('s1'), timeoutMs }).success).toBe(false);
  });

  it.each(['https://beispiel.de/kontakt', 'http://localhost:3000', '/kontakt', '{{start_url}}/a'])(
    'accepts open url %s',
    (url) => {
      expect(stepSchema.safeParse({ id: 's', type: 'open', url }).success).toBe(true);
    },
  );

  it.each(['ftp://beispiel.de', 'javascript:alert(1)', 'beispiel.de', ''])(
    'rejects open url %j',
    (url) => {
      expect(stepSchema.safeParse({ id: 's', type: 'open', url }).success).toBe(false);
    },
  );

  it('allows an empty fill value so a step can clear a field', () => {
    const step = { id: 's', type: 'fill', target: { by: 'label', label: 'Name' }, value: '' };
    expect(stepSchema.safeParse(step).success).toBe(true);
  });

  it('accepts all assertion kinds', () => {
    const assertions = [
      { kind: 'textVisible', text: 'Vielen Dank' },
      { kind: 'elementVisible', target: { by: 'testId', testId: 'ok' } },
      { kind: 'urlContains', value: '/danke' },
      { kind: 'titleContains', value: 'Danke' },
    ];
    for (const assertion of assertions) {
      expect(stepSchema.safeParse({ id: 's', type: 'assert', assertion }).success).toBe(true);
    }
  });

  it('only allows GA4 as analytics provider for now', () => {
    const ga4 = { id: 's', type: 'analytics', provider: 'ga4', event: 'generate_lead' };
    expect(stepSchema.safeParse(ga4).success).toBe(true);
    expect(stepSchema.safeParse({ ...ga4, provider: 'matomo' }).success).toBe(false);
  });

  it.each(['ticketNr', 'end_url', 'a1'])('accepts extract variable name %s', (saveAs) => {
    const step = { id: 's', type: 'extract', target: { by: 'css', selector: '#t' }, saveAs };
    expect(stepSchema.safeParse(step).success).toBe(true);
  });

  it.each(['1ticket', 'ticket-nr', 'Ticket', 'secret.x'])(
    'rejects extract variable name %s',
    (saveAs) => {
      const step = { id: 's', type: 'extract', target: { by: 'css', selector: '#t' }, saveAs };
      expect(stepSchema.safeParse(step).success).toBe(false);
    },
  );

  it('limits a fixed wait to 60 seconds', () => {
    const wait = (ms: number) => ({ id: 's', type: 'wait', until: { kind: 'duration', ms } });
    expect(stepSchema.safeParse(wait(60_000)).success).toBe(true);
    expect(stepSchema.safeParse(wait(60_001)).success).toBe(false);
    expect(stepSchema.safeParse(wait(0)).success).toBe(false);
  });

  it('accepts waiting for an element or for network idle', () => {
    const element = { kind: 'element', target: { by: 'text', text: 'Fertig' } };
    expect(stepSchema.safeParse({ id: 's', type: 'wait', until: element }).success).toBe(true);
    const idle = { kind: 'networkIdle' };
    expect(stepSchema.safeParse({ id: 's', type: 'wait', until: idle }).success).toBe(true);
  });

  it('accepts screenshot and ai steps', () => {
    expect(stepSchema.safeParse({ id: 's', type: 'screenshot' }).success).toBe(true);
    expect(
      stepSchema.safeParse({ id: 's', type: 'ai', instruction: 'Akzeptiere das Cookie-Banner' })
        .success,
    ).toBe(true);
  });

  it('rejects empty ai instructions', () => {
    expect(stepSchema.safeParse({ id: 's', type: 'ai', instruction: '' }).success).toBe(false);
  });

  it('has no code steps: own code on the server is deliberately not offered', () => {
    expect(
      stepSchema.safeParse({ id: 's', type: 'code', source: "await page.goto('/')" }).success,
    ).toBe(false);
  });
});

describe('flowSchema', () => {
  it('parses a typical contact form flow', () => {
    const flow = flowSchema.parse({
      version: 1,
      steps: [
        { id: 'open', type: 'open', url: 'https://beispiel.de/kontakt' },
        {
          id: 'mail',
          type: 'fill',
          target: { by: 'label', label: 'E-Mail' },
          value: '{{faker.email}}',
        },
        click('send'),
        { id: 'check', type: 'assert', assertion: { kind: 'textVisible', text: 'Vielen Dank' } },
      ],
    });
    expect(flow.steps).toHaveLength(4);
  });

  it('rejects a flow without steps', () => {
    expect(flowSchema.safeParse({ version: 1, steps: [] }).success).toBe(false);
  });

  it('rejects more than 200 steps', () => {
    const steps = Array.from({ length: 201 }, (_, i) => click(`s${i}`));
    expect(flowSchema.safeParse({ version: 1, steps }).success).toBe(false);
  });

  it('reports a duplicate step id at the second occurrence', () => {
    const result = flowSchema.safeParse({
      version: 1,
      steps: [click('a'), click('b'), click('a')],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['steps', 2, 'id']);
  });

  it('reports two extract steps writing the same variable', () => {
    const extract = (id: string) => ({
      id,
      type: 'extract',
      target: { by: 'css', selector: '#ticket' },
      saveAs: 'ticketNr',
    });
    const result = flowSchema.safeParse({ version: 1, steps: [extract('a'), extract('b')] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['steps', 1, 'saveAs']);
  });

  it('rejects an unknown flow version', () => {
    expect(flowSchema.safeParse({ version: 2, steps: [click('a')] }).success).toBe(false);
  });
});

describe('messages for the editor', () => {
  const messageAt = (input: unknown, path: (string | number)[]) =>
    flowSchema
      .safeParse(input)
      .error?.issues.find((issue) => JSON.stringify(issue.path) === JSON.stringify(path))?.message;

  it('says in German what is missing in an empty field', () => {
    const flow = {
      version: 1,
      steps: [
        { id: 'a', type: 'click', target: { by: 'label', label: '' } },
        { id: 'b', type: 'select', target: { by: 'css', selector: 'select' }, option: '' },
        { id: 'c', type: 'assert', assertion: { kind: 'textVisible', text: '' } },
        { id: 'd', type: 'analytics', provider: 'ga4', event: '' },
      ],
    };
    expect(messageAt(flow, ['steps', 0, 'target', 'label'])).toBe('Bitte ausfüllen.');
    expect(messageAt(flow, ['steps', 1, 'option'])).toBe('Bitte ausfüllen.');
    expect(messageAt(flow, ['steps', 2, 'assertion', 'text'])).toBe('Bitte ausfüllen.');
    expect(messageAt(flow, ['steps', 3, 'event'])).toBe('Bitte ausfüllen.');
  });

  it('explains which addresses an open step accepts', () => {
    const flow = { version: 1, steps: [{ id: 'a', type: 'open', url: 'kontakt' }] };
    expect(messageAt(flow, ['steps', 0, 'url'])).toBe(
      'Adresse muss mit http://, https:// oder / beginnen.',
    );
  });

  it('names the allowed range for timeouts and waits', () => {
    const flow = {
      version: 1,
      steps: [
        { id: 'a', type: 'click', target: { by: 'text', text: 'Los' }, timeoutMs: 50 },
        { id: 'b', type: 'wait', until: { kind: 'duration', ms: 90_000 } },
      ],
    };
    expect(messageAt(flow, ['steps', 0, 'timeoutMs'])).toBe(
      'Timeout muss zwischen 0,1 und 120 Sekunden liegen.',
    );
    expect(messageAt(flow, ['steps', 1, 'until', 'ms'])).toBe(
      'Wartezeit muss zwischen 0,001 und 60 Sekunden liegen.',
    );
  });

  it('asks for at least one step', () => {
    expect(messageAt({ version: 1, steps: [] }, ['steps'])).toBe(
      'Der Ablauf braucht mindestens einen Schritt.',
    );
  });
});

describe('basicAuth steps (.htaccess password protection)', () => {
  it('take a user name and a password', () => {
    const step = stepSchema.parse({
      id: 'auth',
      type: 'basicAuth',
      username: 'kunde',
      password: '{{secret.htaccess-beispiel-de}}',
    });
    expect(step).toMatchObject({ type: 'basicAuth', username: 'kunde' });
  });

  it('need both', () => {
    const result = stepSchema.safeParse({
      id: 'auth',
      type: 'basicAuth',
      username: '',
      password: '',
    });
    expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      ['username', 'Bitte ausfüllen.'],
      ['password', 'Bitte ausfüllen.'],
    ]);
  });
});
