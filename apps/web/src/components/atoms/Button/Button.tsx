import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-input font-medium whitespace-nowrap',
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-border-strong bg-surface text-text hover:bg-neutral-soft',
        danger: 'bg-danger text-on-primary hover:bg-danger-hover',
        ghost: 'bg-transparent text-text-muted hover:bg-neutral-soft hover:text-text',
      },
      size: {
        md: 'px-4 py-2.5 text-body',
        sm: 'px-3 py-1.5 text-meta',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> &
  VariantProps<typeof buttonVariants> & {
    type?: 'button' | 'submit' | 'reset';
    /** Leading icon, rendered before the label. Mark decorative icons with aria-hidden. */
    icon?: ReactNode;
    /** Shows a spinner, disables the button and sets aria-busy. */
    loading?: boolean;
    /** Renders a link that looks like a button, e.g. "Abbrechen" back to the job list. */
    href?: string;
  };

export function Button({
  type = 'button',
  variant,
  size,
  fullWidth,
  icon,
  loading = false,
  disabled,
  className,
  children,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className);
  if (href !== undefined) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
