/** "Peter Stuhlmann" → "PS", "Lena" → "LE", "" → "?". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] as string).slice(0, 2).toUpperCase();
  return `${(words[0] as string)[0]}${(words.at(-1) as string)[0]}`.toUpperCase();
}

export type AvatarProps = { name: string };

export function Avatar({ name }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-small font-semibold text-on-primary"
    >
      {initials(name)}
    </span>
  );
}
