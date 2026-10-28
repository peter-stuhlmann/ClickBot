import type { z } from 'zod';

export type ValidationIssue = { path: string; message: string };

/** Input was rejected before it reached the database. `issues` point at the offending fields. */
export class ValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(`Ungültige Eingabe: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} ${id} nicht gefunden.`);
    this.name = 'NotFoundError';
  }
}

/** Turns zod issues into ValidationIssues with dotted paths below `prefix`. */
export function issuesFromZod(prefix: string, error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}
