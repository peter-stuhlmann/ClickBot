import type { ReactNode } from 'react';

/** Props the control inside a Field must spread, so label, hint and error belong to it. */
export type FieldControlProps = {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

export type FieldProps = {
  /** Id of the control; label, hint and error are linked to it. */
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/** Label above a control, with a hint or an error message below it. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-medium text-text">
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-small text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
