import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Primary call to action, e.g. a <Button>. */
  action?: ReactNode
  secondaryAction?: ReactNode
  /** Heading level for the title so it fits the page outline. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  compact?: boolean
  className?: string
}

function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  headingLevel: Heading = 'h3',
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-12',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'flex items-center justify-center rounded-card bg-primary-subtle text-accent',
            compact ? 'size-12 [&_svg]:size-6' : 'size-14 [&_svg]:size-7',
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1.5">
        <Heading className="text-h4 text-foreground">{title}</Heading>
        {description && <p className="text-body-sm text-foreground-muted">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}

export default EmptyState
