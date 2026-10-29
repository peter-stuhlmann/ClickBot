import { describe, expect, it } from 'vitest';
import { unknownTagHint } from './css-selector';

describe('unknownTagHint', () => {
  it('explains a bare word that is no HTML element, with class and id as the likely meaning', () => {
    expect(unknownTagHint('decline')).toBe(
      '„decline“ sucht ein Element <decline>, das es in HTML nicht gibt. Gemeint ist wohl .decline (Klasse) oder #decline (ID).',
    );
  });

  it('finds the unknown word anywhere in a longer selector', () => {
    expect(unknownTagHint('div.consent decline')).toMatch(/^„decline“ sucht/);
    expect(unknownTagHint('#banner > accept')).toMatch(/^„accept“ sucht/);
    expect(unknownTagHint('ul, akzeptieren')).toMatch(/^„akzeptieren“ sucht/);
  });

  it.each([
    'button',
    'BUTTON',
    'button.decline',
    '#decline',
    '.decline',
    '[data-action="decline"]',
    'button[aria-label="decline"]',
    'a:hover',
    'input:not([type=hidden])',
    'li:nth-child(2) > a',
    'svg path',
    'my-consent-banner',
    '*',
    'div::before',
    "button[title='accept all']",
  ])('accepts %s', (selector) => {
    expect(unknownTagHint(selector)).toBeNull();
  });

  it('says nothing about an empty field', () => {
    expect(unknownTagHint('   ')).toBeNull();
  });
});
