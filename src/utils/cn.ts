export type ClassValue = string | number | bigint | boolean | null | undefined

/**
 * Joins class names, skipping anything that isn't a non-empty string
 * (so `condition && 'class'` patterns work).
 * Note: this does not resolve conflicting Tailwind classes; pass overrides
 * that don't clash with a component's base classes, or use `!` when needed.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ')
}
