import type { FormState } from './views';

/**
 * Turns validation issues (path + message) into what a form shows: "form" is about the whole
 * form, every other path belongs to the field of the same name. The first message per field wins.
 */
export function toFormState(
  issues: { path: string; message: string }[],
  values: Record<string, string> = {},
): FormState {
  const state: FormState = { values };
  const fieldErrors: Record<string, string> = {};
  for (const { path, message } of issues) {
    if (path === 'form') state.error ??= message;
    else fieldErrors[path.split('.')[0] as string] ??= message;
  }
  if (Object.keys(fieldErrors).length > 0) state.fieldErrors = fieldErrors;
  return state;
}

/** A text field of a form, '' if it is missing or a file. */
export function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
