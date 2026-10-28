import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from './password';

describe('passwordProblem', () => {
  it('accepts a long password with letters and a digit or symbol', () => {
    expect(passwordProblem('sonne-wolke-42', 'peter@agentur.de')).toBeNull();
    expect(passwordProblem('Grüne Äpfel & Birnen')).toBeNull();
  });

  it.each([
    ['kurz-1', `Mindestens ${PASSWORD_MIN} Zeichen.`],
    [`a1${'x'.repeat(PASSWORD_MAX)}`, `Höchstens ${PASSWORD_MAX} Zeichen.`],
    ['nurbuchstabenhier', 'Neben Buchstaben mindestens eine Ziffer oder ein Sonderzeichen.'],
    ['1234567890123', 'Neben Buchstaben mindestens eine Ziffer oder ein Sonderzeichen.'],
  ])('rejects %j', (password, message) => {
    expect(passwordProblem(password)).toBe(message);
  });

  it('rejects a password containing the name part of the e-mail address', () => {
    expect(passwordProblem('Peter-2026-sicher', 'peter@agentur.de')).toBe(
      'Das Passwort darf deine E-Mail-Adresse nicht enthalten.',
    );
  });

  it('ignores very short name parts, which would forbid too much', () => {
    expect(passwordProblem('ab-cd-ef-12345', 'ab@agentur.de')).toBeNull();
  });
});
