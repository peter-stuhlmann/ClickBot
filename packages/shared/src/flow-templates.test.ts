import { describe, expect, it } from 'vitest';
import type { Flow, Step } from './flow';
import { templateFlowSchema, toTemplateFlow } from './flow-templates';

const START = 'https://beispiel.de/shop';
// What the schema fills in for every step.
const base = { timeoutMs: 10_000, aiFallback: true };
const click = (id: string): Step => ({
  ...base,
  id,
  type: 'click',
  target: { by: 'role', role: 'button', name: 'Absenden' },
});
const open = (id: string, url: string): Step => ({ ...base, id, type: 'open', url });
const flow = (...steps: Step[]): Flow => ({ version: 1, steps });

describe('toTemplateFlow', () => {
  it('leaves out opening the start page, which every job does with its own', () => {
    expect(toTemplateFlow(flow(open('s', START), click('c')), START).steps).toEqual([click('c')]);
    // The same address, written a little differently.
    expect(toTemplateFlow(flow(open('s', 'https://BEISPIEL.de/shop'), click('c')), START)).toEqual(
      flow(click('c')),
    );
    // Another place on the page is another address.
    expect(
      toTemplateFlow(flow(open('s', 'https://beispiel.de/shop#top'), click('c')), START),
    ).toEqual(flow(open('s', '/shop#top'), click('c')));
  });

  it('turns pages of the own website into paths, so the template fits every website', () => {
    const steps = toTemplateFlow(
      flow(
        open('s', START),
        open('a', 'https://beispiel.de/kontakt?von=bot#formular'),
        open('b', 'https://anderswo.de/danke'),
        open('c', '/agb'),
        open('d', '{{faker.url}}'),
      ),
      START,
    ).steps;
    expect(steps.map((step) => (step.type === 'open' ? step.url : step.type))).toEqual([
      '/kontakt?von=bot#formular',
      'https://anderswo.de/danke',
      '/agb',
      '{{faker.url}}',
    ]);
  });

  it('only drops the start page as the first step; opened again later it stays', () => {
    const steps = toTemplateFlow(flow(click('c'), open('s', START)), START).steps;
    expect(steps).toEqual([click('c'), open('s', '/shop')]);
  });

  it('leaves out password protection and steps the forms cannot edit', () => {
    const steps = toTemplateFlow(
      flow(
        {
          ...base,
          id: 'pw',
          type: 'basicAuth',
          username: 'team',
          password: '{{secret.htaccess-beispiel.de}}',
        },
        open('s', START),
        {
          ...base,
          id: 'x',
          type: 'extract',
          target: { by: 'testId', testId: 'nr' },
          saveAs: 'nr',
        },
        {
          ...base,
          id: 'k',
          type: 'ai',
          instruction: 'Bestellung prüfen',
        },
        click('c'),
      ),
      START,
    ).steps;
    expect(steps).toEqual([click('c')]);
  });

  it('keeps every address as it is without a usable start URL', () => {
    const steps = toTemplateFlow(flow(open('s', START), click('c')), 'kein-link').steps;
    expect(steps).toEqual([open('s', START), click('c')]);
  });
});

describe('templateFlowSchema', () => {
  it('accepts the steps of the step forms', () => {
    expect(templateFlowSchema.safeParse(flow(open('a', '/kontakt'), click('c'))).success).toBe(
      true,
    );
  });

  it('refuses password protection and steps the forms cannot edit, at the step', () => {
    const result = templateFlowSchema.safeParse(
      flow(
        click('c'),
        {
          ...base,
          id: 'pw',
          type: 'basicAuth',
          username: 'team',
          password: 'geheim',
        },
        {
          ...base,
          id: 'k',
          type: 'ai',
          instruction: 'Bestellung prüfen',
        },
      ),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      ['steps.1.type', 'Passwortschutz gehört zu einer Website und nicht in eine Vorlage.'],
      ['steps.2.type', 'Diesen Schritt-Typ gibt es in Vorlagen noch nicht.'],
    ]);
  });

  it('needs at least one step, like every flow', () => {
    expect(templateFlowSchema.safeParse(flow()).success).toBe(false);
  });
});
