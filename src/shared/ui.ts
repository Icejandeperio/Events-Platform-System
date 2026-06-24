import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class name merge utility for shadcn/ui components.
 *
 * @remarks Combines clsx (conditional classes) with tailwind-merge (deduplication)
 * so Tailwind utility conflicts are resolved correctly in composed components.
 * Import as `import { cn } from '@shared/ui'`.
 * @param inputs - Any number of class strings, arrays, or objects.
 * @returns A single merged, deduplicated class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
