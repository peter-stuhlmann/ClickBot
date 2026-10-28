import { errors } from 'playwright';

/** A step failure whose message is ready for the report (German, no stack trace). */
export class StepError extends Error {
  override name = 'StepError';
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
}

export function isTimeout(error: unknown): boolean {
  return error instanceof errors.TimeoutError;
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
