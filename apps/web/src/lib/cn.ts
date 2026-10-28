import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge must know the custom font-size tokens, otherwise it mistakes `text-body`
// for a colour and drops it next to `text-text-muted`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['label', 'small', 'meta', 'body', 'card', 'h2', 'h1', 'stat'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
