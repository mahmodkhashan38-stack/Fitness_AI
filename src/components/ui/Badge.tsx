import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
type BadgeSize = 'sm' | 'md'

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-elevated text-foreground-muted',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  outline: 'border border-border-strong text-foreground-muted',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'h-5 gap-1 px-2 text-caption font-semibold [&_svg]:size-3',
  md: 'h-6 gap-1.5 px-2.5 text-caption font-semibold [&_svg]:size-3.5',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  /** Icon before the text. Status is always conveyed by the text too, never colour alone. */
  icon?: ReactNode
}

function Badge({ variant = 'neutral', size = 'md', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="flex" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}

export default Badge
