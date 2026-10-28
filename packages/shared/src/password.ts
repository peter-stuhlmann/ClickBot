/**
 * Rules for new passwords, the same in the browser and on the server. Taken over from seo-analyse
 * (src/lib/password-policy.ts): length, a mix of characters and not the e-mail address. The
 * server also checks known data leaks (Have I Been Pwned), see apps/web/src/server/pwned.ts.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const LETTER = /[a-zA-ZäöüÄÖÜß]/;
const DIGIT_OR_SYMBOL = /[0-9\W_]/;

/** The first broken rule as a sentence for the form, or null if the password is fine. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Mindestens ${PASSWORD_MIN} Zeichen.`;
  if (password.length > PASSWORD_MAX) return `Höchstens ${PASSWORD_MAX} Zeichen.`;
  if (!LETTER.test(password) || !DIGIT_OR_SYMBOL.test(password)) {
    return 'Neben Buchstaben mindestens eine Ziffer oder ein Sonderzeichen.';
  }
  const local = email?.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 3 && password.toLowerCase().includes(local)) {
    return 'Das Passwort darf deine E-Mail-Adresse nicht enthalten.';
  }
  return null;
}
