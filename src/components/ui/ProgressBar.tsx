import { useId } from 'react'
import { cn } from '@/utils/cn'

type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'
type ProgressSize = 'sm' | 'md' | 'lg'

const toneClasses: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

const sizeClasses: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
}

export interface ProgressBarProps {
  value: number
  max?: number
  /** Visible label; also the accessible name. */
  label: string
  hideLabel?: boolean
  /** Text shown on the right and announced as the value, e.g. "1,840 / 2,600 kcal". */
  valueText?: string
  /** Show the percentage when no valueText is given. */
  showValue?: boolean
  tone?: ProgressTone
  size?: ProgressSize
  className?: string
}

function ProgressBar({
  value,
  max = 100,
  label,
  hideLabel = false,
  valueText,
  showValue = true,
  tone = 'primary',
  size = 'md',
  className,
}: ProgressBarProps) {
  const labelId = useId()
  const safeMax = max > 0 ? max : 100
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const percent = Math.round((clamped / safeMax) * 100)
  const displayValue = valueText ?? `${percent}%`

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {(!hideLabel || showValue) && (
        <div className={cn('flex items-baseline gap-3', hideLabel ? 'justify-end' : 'justify-between')}>
          {!hideLabel && (
            <span id={labelId} className="text-label text-foreground">
              {label}
            </span>
          )}
          {showValue && (
            <span className="numeric text-body-sm text-foreground-muted" aria-hidden="true">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-labelledby={hideLabel ? undefined : labelId}
        aria-label={hideLabel ? label : undefined}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={displayValue}
        className={cn('w-full overflow-hidden rounded-full bg-surface-elevated', sizeClasses[size])}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-standard',
            toneClasses[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
