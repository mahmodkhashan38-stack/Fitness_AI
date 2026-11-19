import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

const variantConfig: Record<AlertVariant, { classes: string; icon: ReactNode; srPrefix: string }> = {
  info: { classes: 'bg-info-subtle text-info', icon: <Info />, srPrefix: 'Information' },
  success: { classes: 'bg-success-subtle text-success', icon: <CircleCheck />, srPrefix: 'Success' },
  warning: { classes: 'bg-warning-subtle text-warning', icon: <TriangleAlert />, srPrefix: 'Warning' },
  danger: { classes: 'bg-danger-subtle text-danger', icon: <CircleAlert />, srPrefix: 'Error' },
}

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  /** Optional action, e.g. a small Button. */
  action?: ReactNode
  /** Shows a dismiss button when provided. */
  onDismiss?: () => void
  /**
   * Announce the alert immediately to screen readers.
   * Use for messages that appear in response to an action, not for static page content.
   */
  live?: boolean
  className?: string
}

function Alert({ variant = 'info', title, children, action, onDismiss, live = false, className }: AlertProps) {
  const config = variantConfig[variant]
  const liveRole = variant === 'danger' || variant === 'warning' ? 'alert' : 'status'

  return (
    <div
      role={live ? liveRole : undefined}
      className={cn('flex gap-3 rounded-card p-4', config.classes, className)}
    >
      <span className="mt-0.5 flex shrink-0 [&_svg]:size-5" aria-hidden="true">
        {config.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && (
          <p className="text-label font-semibold">
            <span className="sr-only">{config.srPrefix}: </span>
            {title}
          </p>
        )}
        {children && (
          <div className="text-body-sm text-foreground">
            {!title && <span className="sr-only">{config.srPrefix}: </span>}
            {children}
          </div>
        )}
        {action && <div className="pt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="focus-ring -m-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-hover hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default Alert
