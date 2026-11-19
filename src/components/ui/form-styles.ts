import { cn } from '@/utils/cn'

/** Shared visual styles for text-like controls (input, textarea, select). */
export const controlClasses = cn(
  'w-full rounded-control border bg-surface text-body text-foreground placeholder:text-foreground-muted',
  'border-input transition-[border-color,box-shadow,background-color] duration-150 ease-standard',
  'hover:border-foreground-muted',
  'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25',
)
