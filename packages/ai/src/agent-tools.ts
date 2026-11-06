import type { AiTool } from './client';

/**
 * The actions of the AI step as tools. The schemas are flat (no oneOf/anyOf), because Claude,
 * OpenAI and Gemini each understand a different part of JSON Schema; what comes back is checked
 * again with the real step schemas (`parseAgentToolCall`), so these only guide the model.
 */

const text = (description: string) => ({ type: 'string', description });

const TARGET = {
  type: 'object',
  description:
    'Finds exactly one element. Names are copied exactly from the page structure. Prefer by=role for buttons and links and by=label for form fields. Elements in iframes (cookie banners) are found too.',
  properties: {
    by: { type: 'string', enum: ['role', 'label', 'text', 'css', 'testId'] },
    role: text('With by=role: the ARIA role, e.g. button, link, heading, textbox.'),
    name: text('With by=role: the accessible name, e.g. "Absenden". Optional.'),
    label: text('With by=label: the label of the field, e.g. "E-Mail".'),
    text: text('With by=text: the visible text.'),
    exact: { type: 'boolean', description: 'With by=text: the whole text must match.' },
    selector: text('With by=css: a CSS selector, e.g. "#id".'),
    testId: text('With by=testId: the data-testid.'),
  },
  required: ['by'],
};

const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
});

const ACTIONS: AiTool[] = [
  {
    name: 'click',
    description: 'Click an element.',
    parameters: object({ target: TARGET }, ['target']),
  },
  {
    name: 'fill',
    description:
      'Type into a form field. The value is text or a variable such as {{faker.email}} or {{secret.NAME}}.',
    parameters: object({ target: TARGET, value: text('Text or variable.') }, ['target', 'value']),
  },
  {
    name: 'select',
    description: 'Choose an option of a drop-down by its visible text.',
    parameters: object({ target: TARGET, option: text('Visible option text.') }, [
      'target',
      'option',
    ]),
  },
  {
    name: 'press',
    description:
      'Press a key or a combination like "Tab" or "Control+a". With target it goes to that element.',
    parameters: object({ key: text('Key or combination.'), target: TARGET }, ['key']),
  },
  {
    name: 'scroll',
    description:
      'Scroll the page: to an element (kind=element + target), by a distance (kind=by + direction + distance in px), to a position from the top (kind=position + y), or to an edge (kind=top, bottom, left, right). Needed to load images and content below the fold.',
    parameters: object(
      {
        to: object(
          {
            kind: {
              type: 'string',
              enum: ['element', 'by', 'position', 'top', 'bottom', 'left', 'right'],
            },
            target: TARGET,
            direction: { type: 'string', enum: ['down', 'up', 'right', 'left'] },
            distance: { type: 'integer', description: 'With kind=by: pixels, at least 1.' },
            y: { type: 'integer', description: 'With kind=position: pixels from the top.' },
            x: {
              type: 'integer',
              description: 'With kind=position: pixels from the left. Optional.',
            },
          },
          ['kind'],
        ),
      },
      ['to'],
    ),
  },
  {
    name: 'open',
    description:
      'Open a page of the website under test, e.g. "/kontakt". Other websites are not allowed.',
    parameters: object({ url: text('A path or a full address on the website under test.') }, [
      'url',
    ]),
  },
  {
    name: 'wait',
    description:
      'Wait for a duration (kind=duration + ms), for an element (kind=element + target) or until the page loads nothing more (kind=networkIdle).',
    parameters: object(
      {
        until: object(
          {
            kind: { type: 'string', enum: ['duration', 'element', 'networkIdle'] },
            ms: { type: 'integer', description: 'With kind=duration: milliseconds.' },
            target: TARGET,
          },
          ['kind'],
        ),
      },
      ['until'],
    ),
  },
  {
    name: 'inspect',
    description:
      'Read what the browser computed for ONE element: its text, font colour (as rgb and #HEX), background colour, font size, weight and family. Use it for every claim about colours, sizes or fonts. Changes nothing on the page.',
    parameters: object({ target: TARGET }, ['target']),
  },
  {
    name: 'query',
    description:
      'List ALL elements matching a CSS selector (also in iframes): how many there are and, for each of the first 40, its attributes. For images: alt, src, title, aria-label, loading; for links: href; for others: id, class, aria-label, role and the text. A missing attribute is told from an empty one ("alt fehlt" / "alt leer"), which the page structure cannot do. Use it for attributes and counts. Changes nothing on the page.',
    parameters: object(
      {
        selector: text('A CSS selector, e.g. "img" or "main a".'),
        attributes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Attributes to show instead of the usual ones, e.g. ["alt"].',
        },
      },
      ['selector'],
    ),
  },
];

const VERDICT: AiTool = {
  name: 'verdict',
  description:
    'Give the verdict once every sub-goal is decided. Goal, evidence and summary in German.',
  parameters: object(
    {
      summary: text(
        'The result of the whole test in ONE sentence that answers the goal unmistakably and names the concrete values you measured, with numbers, e.g. "h1-Überschriften auf 3 Produktseiten sind rot (#C80000)". No "Testergebnis:" prefix, no hedging.',
      ),
      criteria: {
        type: 'array',
        description:
          'The sub-goals, one per claim of the goal; one for a whole group of similar items.',
        items: object(
          {
            goal: text('The sub-goal, one sentence.'),
            status: {
              type: 'string',
              enum: ['met', 'failed', 'unknown'],
              description:
                'met: you saw it in this run. failed: you checked it and it is not so. unknown: you could not check it (captcha, no fitting login, page did not load).',
            },
            evidence: text('What you saw or measured, with counts; or why it is unknown.'),
          },
          ['goal', 'status', 'evidence'],
        ),
      },
    },
    ['summary', 'criteria'],
  ),
};

/** The tools of a round: every action and the verdict, or only the verdict once none are left. */
export function agentTools({ final = false } = {}): AiTool[] {
  return final ? [VERDICT] : [...ACTIONS, VERDICT];
}

type Raw = Record<string, unknown>;

// Models fill unused fields with "" or null; a target with such fields would not pass its schema.
function pruned(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruned);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Raw)
      .filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')
      .map(([key, entry]) => [key, pruned(entry)]),
  );
}

/**
 * A tool call as the object the text protocol uses (`{"type":"click","target":…}`), so both ways
 * share one check. The value of a `fill` may be empty on purpose and is kept.
 */
export function rawFromToolCall(call: { name: string; args: Raw }): Raw {
  const { value, ...rest } = call.args;
  return {
    ...(pruned(rest) as Raw),
    ...(value !== undefined ? { value } : {}),
    type: call.name,
  };
}
