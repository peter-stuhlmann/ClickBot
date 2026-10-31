// @vitest-environment node
import type { TemplateRow } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { toTemplateView } from './templates-view';

const now = new Date('2026-11-05T12:00:00Z');

const row = (overrides: Partial<TemplateRow> = {}): TemplateRow => ({
  id: 'vorlage-1',
  name: 'Kontaktformular',
  description: 'Füllt das Formular aus.',
  flow: {
    version: 1,
    steps: [{ id: 'kontakt', type: 'open', url: '/kontakt', timeoutMs: 10_000, aiFallback: true }],
  },
  steps: 1,
  updatedAt: new Date('2026-11-05T10:00:00Z'),
  createdByName: 'Peter Stuhlmann',
  ...overrides,
});

describe('toTemplateView', () => {
  it('names the template with its steps, when it changed and who made it', () => {
    const view = toTemplateView(row(), now);
    expect(view).toMatchObject({
      id: 'vorlage-1',
      name: 'Kontaktformular',
      href: '/vorlagen/vorlage-1',
      meta: expect.stringMatching(/^1 Schritt · geändert .+ von Peter Stuhlmann$/),
    });
    expect(view.steps.map((step) => step.title)).toEqual(['Öffne /kontakt']);
  });

  it('counts several steps and leaves out a creator whose account is gone', () => {
    const view = toTemplateView(row({ steps: 3, createdByName: null }), now);
    expect(view.meta).toMatch(/^3 Schritte · geändert [^·]+$/);
    expect(view.meta).not.toContain(' von ');
  });
});
