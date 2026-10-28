import 'server-only';
import { createHash } from 'node:crypto';
import { passwordProblem } from '@click-bot/shared';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Rules plus Have I Been Pwned, as in seo-analyse (src/lib/password-check.ts): k-anonymity, only
 * the first 5 characters of the SHA-1 hash leave the server. If the service is unreachable, the
 * password is not blocked (the rules still apply). PWNED_CHECK=off skips the lookup in tests.
 */
export async function newPasswordProblem(
  password: string,
  email: string | undefined,
  fetchRange: Fetch = fetch,
): Promise<string | null> {
  const rule = passwordProblem(password, email);
  if (rule) return rule;
  if (process.env.PWNED_CHECK === 'off') return null;

  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    const response = await fetchRange(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HIBP antwortet mit ${response.status}`);
    const suffix = hash.slice(5);
    const line = (await response.text())
      .split('\n')
      .find((entry) => entry.startsWith(`${suffix}:`));
    const count = line ? Number(line.split(':')[1]) : 0;
    if (count > 0) {
      return `Dieses Passwort ist aus Datenlecks bekannt (${count.toLocaleString('de-DE')}-mal). Bitte ein anderes wählen.`;
    }
  } catch (error) {
    console.warn(
      '[passwort] Prüfung auf Datenlecks nicht möglich:',
      error instanceof Error ? error.message : error,
    );
  }
  return null;
}
