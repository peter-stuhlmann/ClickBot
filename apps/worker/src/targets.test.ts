import { describe, expect, it } from 'vitest';
import { describeTarget } from './targets';

describe('describeTarget', () => {
  it.each([
    [{ by: 'role', role: 'button', name: 'Absenden' }, 'Rolle „button“ mit Name „Absenden“'],
    [{ by: 'role', role: 'alert' }, 'Rolle „alert“'],
    [{ by: 'label', label: 'E-Mail' }, 'Feld „E-Mail“'],
    [{ by: 'text', text: 'Vielen Dank', exact: false }, 'Text „Vielen Dank“'],
    [{ by: 'css', selector: '#ticket' }, 'CSS „#ticket“'],
    [{ by: 'testId', testId: 'ticket' }, 'Test-ID „ticket“'],
  ] as const)('describes %o as %s', (target, text) => {
    expect(describeTarget(target)).toBe(text);
  });
});
