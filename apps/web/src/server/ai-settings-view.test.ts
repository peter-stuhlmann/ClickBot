// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toAiProviderViews } from './ai-settings-view';

describe('toAiProviderViews', () => {
  it('lists all five providers, set up or not, in the order of the page', () => {
    const views = toAiProviderViews([
      {
        kind: 'anthropic',
        model: 'claude-sonnet-5-5',
        baseUrl: null,
        keyHint: '…1234',
        isDefault: true,
        updatedAt: new Date(),
      },
    ]);
    expect(views.map((view) => [view.label, view.configured])).toEqual([
      ['Gemini', false],
      ['OpenAI', false],
      ['Perplexity', false],
      ['Claude', true],
      ['Custom', false],
    ]);
    expect(views[3]).toMatchObject({
      kind: 'anthropic',
      isDefault: true,
      model: 'claude-sonnet-5-5',
      keyHint: '…1234',
      needsBaseUrl: false,
      baseUrl: '',
    });
  });

  it('gives only the custom endpoint an address and an optional key', () => {
    const custom = toAiProviderViews([
      {
        kind: 'custom',
        model: 'llama',
        baseUrl: 'http://localhost:11434/v1',
        keyHint: null,
        isDefault: false,
        updatedAt: new Date(),
      },
    ])[4];
    expect(custom).toMatchObject({
      needsBaseUrl: true,
      baseUrl: 'http://localhost:11434/v1',
      keyRequired: false,
      keyHint: null,
    });
  });

  it('offers Perplexity its model names, which its API cannot list', () => {
    expect(toAiProviderViews([])[2]?.modelSuggestions).toContain('sonar');
  });
});
