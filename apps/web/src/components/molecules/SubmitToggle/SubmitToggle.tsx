'use client';

import { useFormStatus } from 'react-dom';
import { Toggle, type ToggleProps } from '@/components/atoms/Toggle';

export type SubmitToggleProps = Omit<ToggleProps, 'type'>;

/**
 * A toggle that sends its form (a server action) and waits visibly until the action is done,
 * so pausing a test answers at once. Needs a surrounding `<form action={…}>`.
 */
export function SubmitToggle({ disabled, ...props }: SubmitToggleProps) {
  const { pending } = useFormStatus();
  return (
    <Toggle
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    />
  );
}
