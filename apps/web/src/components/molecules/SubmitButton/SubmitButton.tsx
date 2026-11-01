'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/atoms/Button';

export type SubmitButtonProps = Omit<ButtonProps, 'type' | 'loading' | 'href'>;

/**
 * A submit button that shows the spinner while the form's server action runs, so a click
 * answers at once. Needs a surrounding `<form action={…}>`.
 */
export function SubmitButton(props: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}
