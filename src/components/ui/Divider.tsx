import { cn } from '@/utils/cn'

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  /** Optional centred text, e.g. "or". */
  label?: string
  className?: string
}

function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('w-px self-stretch bg-border', className)}
      />
    )
  }

  if (label) {
    return (
      <div role="separator" aria-label={label} className={cn('flex items-center gap-3', className)}>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="text-caption text-foreground-muted" aria-hidden="true">
          {label}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
    )
  }

  return <hr className={cn('h-px w-full border-0 bg-border', className)} />
}

export default Divider
