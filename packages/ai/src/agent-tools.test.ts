import { describe, expect, it } from 'vitest';
import { agentTools, rawFromToolCall } from './agent-tools';
import { parseAgentToolCall } from './agent-step';
import { AiError } from './client';

const call = (name: string, args: Record<string, unknown>) => ({ call: { name, args }, text: '' });
const target = { by: 'role', role: 'button', name: 'Absenden' };

describe('agentTools', () => {
  it('offers every action and the verdict, or only the verdict when no actions are left', () => {
    expect(agentTools().map((tool) => tool.name)).toEqual([
      'click',
      'fill',
      'select',
      'press',
      'scroll',
      'open',
      'wait',
      'inspect',
      'query',
      'verdict',
    ]);
    expect(agentTools({ final: true }).map((tool) => tool.name)).toEqual(['verdict']);
  });

  it('describes each tool, and keeps its schemas flat for all providers', () => {
    for (const tool of agentTools()) {
      expect(tool.description.length, tool.name).toBeGreaterThan(10);
      const json = JSON.stringify(tool.parameters);
      // Claude, OpenAI and Gemini each understand a different part of JSON Schema.
      expect(json, tool.name).not.toMatch(/anyOf|oneOf|allOf|\$ref|additionalProperties/);
      expect(tool.parameters).toMatchObject({ type: 'object' });
    }
  });

  it('tells the model how to measure and count, where it matters', () => {
    const named = Object.fromEntries(agentTools().map((tool) => [tool.name, tool.description]));
    expect(named.inspect).toMatch(/#HEX/);
    expect(named.query).toMatch(/alt fehlt/);
    expect(named.verdict).toMatch(/Goal, evidence and summary in German/);
  });
});

describe('a tool call becomes the same action as the JSON text', () => {
  it.each([
    ['click', { target }, { type: 'click', target }],
    [
      'fill',
      { target: { by: 'label', label: 'E-Mail' }, value: '{{faker.email}}' },
      { type: 'fill', value: '{{faker.email}}' },
    ],
    [
      'select',
      { target: { by: 'label', label: 'Anliegen' }, option: 'Support' },
      { type: 'select' },
    ],
    ['press', { key: 'Enter' }, { type: 'press', key: 'Enter' }],
    ['press', { key: 'Tab', target }, { type: 'press', key: 'Tab', target }],
    ['scroll', { to: { kind: 'by', direction: 'down', distance: 600 } }, { type: 'scroll' }],
    ['scroll', { to: { kind: 'element', target } }, { type: 'scroll' }],
    ['scroll', { to: { kind: 'bottom' } }, { type: 'scroll', to: { kind: 'bottom' } }],
    ['open', { url: '/kontakt' }, { type: 'open', url: '/kontakt' }],
    ['wait', { until: { kind: 'duration', ms: 1000 } }, { type: 'wait' }],
    ['wait', { until: { kind: 'networkIdle' } }, { type: 'wait' }],
  ])('%s', (name, args, expected) => {
    expect(parseAgentToolCall(call(name, args))).toMatchObject({ kind: 'step', step: expected });
  });

  it('reads inspect and query, with or without the attributes', () => {
    expect(parseAgentToolCall(call('inspect', { target: { by: 'css', selector: 'h1' } }))).toEqual({
      kind: 'inspect',
      target: { by: 'css', selector: 'h1' },
    });
    expect(parseAgentToolCall(call('query', { selector: 'img' }))).toEqual({
      kind: 'query',
      selector: 'img',
    });
    expect(parseAgentToolCall(call('query', { selector: 'img', attributes: ['alt'] }))).toEqual({
      kind: 'query',
      selector: 'img',
      attributes: ['alt'],
    });
  });

  it('reads the verdict with its summary and every sub-goal', () => {
    const criteria = [
      { goal: 'Alle Bilder haben ein alt.', status: 'failed', evidence: '3 von 8.' },
    ];
    expect(
      parseAgentToolCall(call('verdict', { summary: '3 von 8 Bildern ohne alt', criteria })),
    ).toEqual({ kind: 'verdict', criteria, summary: '3 von 8 Bildern ohne alt' });
  });

  it('drops the empty fields a model fills in for unused options', () => {
    const action = parseAgentToolCall(
      call('click', { target: { by: 'role', role: 'button', name: '', label: '', exact: null } }),
    );
    expect(action).toMatchObject({ step: { target: { by: 'role', role: 'button' } } });
    expect(JSON.stringify(action)).not.toContain('"name"');
  });

  it('keeps an empty value of a fill, which is allowed (clearing a field)', () => {
    expect(
      rawFromToolCall({
        name: 'fill',
        args: { target: { by: 'label', label: 'Name' }, value: '' },
      }),
    ).toMatchObject({
      type: 'fill',
      value: '',
    });
  });

  it('checks what a call brings like a stored step', () => {
    expect(() => parseAgentToolCall(call('click', { target: { by: 'role' } }))).toThrow(AiError);
    expect(() => parseAgentToolCall(call('open', { url: 'javascript:alert(1)' }))).toThrow(AiError);
    expect(() => parseAgentToolCall(call('press', { key: 'F5' }))).toThrow(AiError);
    expect(() => parseAgentToolCall(call('verdict', { criteria: [] }))).toThrow(AiError);
  });

  it('refuses a tool that is not offered, and an action when none are left', () => {
    expect(() => parseAgentToolCall(call('extract', { target }))).toThrow(/nicht erlaubt/);
    expect(() => parseAgentToolCall(call('rm', {}))).toThrow(/nicht erlaubt/);
    expect(() => parseAgentToolCall(call('click', { target }), { final: true })).toThrow(
      /keine Aktionen mehr/,
    );
  });

  it('replaces a made-up real e-mail address, as in the text protocol', () => {
    const action = parseAgentToolCall(
      call('fill', { target: { by: 'label', label: 'E-Mail' }, value: 'max@gmail.com' }),
    );
    expect(action).toMatchObject({ step: { value: '{{faker.email}}' } });
  });

  it('falls back to JSON text when the model answered in text, and fails with neither', () => {
    expect(
      parseAgentToolCall({ call: null, text: '{"type":"open","url":"/preise"}' }),
    ).toMatchObject({ kind: 'step', step: { type: 'open' } });
    expect(() => parseAgentToolCall({ call: null, text: '  ' })).toThrow(/keinen Werkzeugaufruf/);
  });
});
