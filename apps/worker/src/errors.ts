import { errors } from 'playwright';

/** A step failure whose message is ready for the report (German, no stack trace). */
export class StepError extends Error {
  override name = 'StepError';
}

/**
 * The flow worked, but what the test expects is not so: text, element, URL or title not there,
 * a GA4 event not sent. The run ends "Nicht bestanden", not "Fehlgeschlagen".
 */
export class ExpectationError extends StepError {
  override name = 'ExpectationError';
}

/** No element matched the target in time. A failed click, but for a check an unmet expectation. */
export class ElementNotFoundError extends StepError {
  override name = 'ElementNotFoundError';
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
}

export function isTimeout(error: unknown): boolean {
  return error instanceof errors.TimeoutError;
}

/**
 * A page asked for a password (HTTP 401) and the browser gave up: the full Chromium reports that
 * as an error instead of the answer. The headless shell, Firefox and WebKit return the 401.
 */
export function refusedCredentials(error: unknown): boolean {
  return error instanceof Error && error.message.includes('ERR_INVALID_AUTH_CREDENTIALS');
}

/** Number of elements from Playwright's strict-mode error, or null for other errors. */
export function ambiguousCount(error: unknown): number | null {
  const match = error instanceof Error && /resolved to (\d+) elements/.exec(error.message);
  return match ? Number(match[1]) : null;
}

/** Message for the report: StepErrors as they are, anything else reduced to its first line. */
export function toStepMessage(error: unknown): string {
  if (error instanceof StepError) return error.message;
  const text = error instanceof Error ? error.message : String(error);
  return text.split('\n')[0]?.trim() || 'Unbekannter Fehler.';
}
