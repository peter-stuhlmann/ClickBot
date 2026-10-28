import { describe, expect, it } from 'vitest';
import { isHostAllowed, isValidDomainRule } from './domains';

describe('isHostAllowed', () => {
  it('matches an exact domain', () => {
    expect(isHostAllowed('staging.beispiel.de', ['staging.beispiel.de'])).toBe(true);
  });

  it('does not let an exact rule match subdomains', () => {
    expect(isHostAllowed('www.beispiel.de', ['beispiel.de'])).toBe(false);
  });

  it('matches subdomains with a wildcard rule, but not the bare domain', () => {
    expect(isHostAllowed('staging.beispiel.de', ['*.beispiel.de'])).toBe(true);
    expect(isHostAllowed('a.b.beispiel.de', ['*.beispiel.de'])).toBe(true);
    expect(isHostAllowed('beispiel.de', ['*.beispiel.de'])).toBe(false);
  });

  it('never matches a look-alike domain that only ends with the same letters', () => {
    expect(isHostAllowed('evilbeispiel.de', ['beispiel.de'])).toBe(false);
    expect(isHostAllowed('evilbeispiel.de', ['*.beispiel.de'])).toBe(false);
    expect(isHostAllowed('beispiel.de.evil.com', ['beispiel.de', '*.beispiel.de'])).toBe(false);
  });

  it('ignores case and a trailing dot', () => {
    expect(isHostAllowed('Staging.Beispiel.DE.', ['staging.beispiel.de'])).toBe(true);
  });

  it('matches if any rule matches', () => {
    expect(isHostAllowed('shop.mueller.de', ['beispiel.de', '*.mueller.de'])).toBe(true);
  });

  it('allows nothing with an empty rule list', () => {
    expect(isHostAllowed('beispiel.de', [])).toBe(false);
  });
});

describe('isValidDomainRule', () => {
  it.each(['beispiel.de', '*.beispiel.de', 'staging.beispiel.de', 'localhost', 'xn--mller-kva.de'])(
    'accepts %s',
    (rule) => {
      expect(isValidDomainRule(rule)).toBe(true);
    },
  );

  it.each([
    '*',
    '*.de',
    'https://beispiel.de',
    'beispiel.de/pfad',
    'bei spiel.de',
    '',
    '*beispiel.de',
  ])('rejects %j', (rule) => {
    expect(isValidDomainRule(rule)).toBe(false);
  });
});
