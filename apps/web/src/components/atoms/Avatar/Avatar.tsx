import { cva } from 'class-variance-authority';

/** "Peter Stuhlmann" → "PS", "Lena" → "LE", "" → "?". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] as string).slice(0, 2).toUpperCase();
  return `${(words[0] as string)[0]}${(words.at(-1) as string)[0]}`.toUpperCase();
}

const avatar = cva(
  'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-on-primary',
  {
    variants: {
      size: {
        sm: 'size-8 text-small',
        lg: 'size-20 text-h1',
      },
    },
    defaultVariants: { size: 'sm' },
  },
);

export type AvatarProps = {
  name: string;
  /** The profile picture; without one the initials show. */
  src?: string | null;
  size?: 'sm' | 'lg';
};

/** Decoration beside the name, so it stays out of the accessibility tree. */
export function Avatar({ name, src, size }: AvatarProps) {
  return (
    <span aria-hidden="true" className={avatar({ size })}>
      {src ? (
        // A small square picture from /avatar; next/image would only add a resize step.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
