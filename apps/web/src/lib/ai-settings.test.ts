import { describe, expect, it } from 'vitest';
import { describeConnection } from './ai-settings';

describe('describeConnection', () => {
  it('confirms the entered model', () => {
    expect(
      describeConnection('OpenAI', 'gpt-a', { models: ['gpt-a', 'gpt-b'], modelKnown: true }),
    ).toEqual({
      tone: 'success',
      message: 'Verbindung steht. Das Modell „gpt-a“ ist verfügbar.',
      models: ['gpt-a', 'gpt-b'],
    });
  });

  it('warns about a model the provider does not know', () => {
    expect(
      describeConnection('Gemini', 'gemini-x', { models: ['gemini-a'], modelKnown: false }),
    ).toEqual({
      tone: 'warning',
      message:
        'Verbindung steht, aber Gemini kennt das Modell „gemini-x“ nicht. Bitte eines aus der Liste wählen.',
      models: ['gemini-a'],
    });
  });

  it('points to the list while no model is entered', () => {
    expect(describeConnection('Claude', '', { models: ['a', 'b'], modelKnown: null })).toEqual({
      tone: 'success',
      message: 'Verbindung steht. 2 Modelle verfügbar, Auswahl im Feld „Modell“.',
      models: ['a', 'b'],
    });
    expect(describeConnection('Claude', '', { models: ['a'], modelKnown: null }).message).toBe(
      'Verbindung steht. 1 Modell verfügbar, Auswahl im Feld „Modell“.',
    );
  });

  it('only confirms the connection where models cannot be listed', () => {
    expect(describeConnection('Perplexity', 'sonar', { models: null, modelKnown: null })).toEqual({
      tone: 'success',
      message: 'Verbindung steht.',
    });
  });
});
