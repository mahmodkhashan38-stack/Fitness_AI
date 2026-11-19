import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { cn } from '@/utils/cn'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode
  description?: ReactNode
  /** Put the label before the switch (settings-list style). */
  labelPosition?: 'start' | 'end'
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * On/off toggle built on a native checkbox with role="switch":
 * focusable, Space toggles it, and screen readers announce "on/off".
 */
function Switch({
  label,
  description,
  labelPosition = 'end',
  id,
  disabled,
  className,
  containerClassName,
  ref,
  ...props
}: SwitchProps) {
  const generatedId = useId()
  const switchId = id ?? generatedId
  const descriptionId = `${switchId}-description`

  const control = (
    <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
      <input
        ref={ref}
        id={switchId}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'peer focus-ring absolute inset-0 size-full cursor-pointer appearance-none rounded-full border-[1.5px] border-input bg-surface-elevated',
          'transition-colors duration-200 ease-standard',
          'checked:border-primary-edge checked:bg-primary',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled',
          className,
        )}
        {...props}
      />
      <span
        className={cn(
          'pointer-events-none relative left-1 size-5 rounded-full bg-foreground-muted shadow-card',
          'transition-[translate,background-color] duration-200 ease-standard',
          'peer-checked:translate-x-5 peer-checked:bg-primary-foreground',
          'peer-disabled:bg-disabled-foreground',
        )}
        aria-hidden="true"
      />
    </span>
  )

  const text = (
    <span className="flex min-w-0 flex-col gap-0.5">
      <label
        htmlFor={switchId}
        className={cn('cursor-pointer text-label text-foreground', disabled && 'cursor-not-allowed text-disabled-foreground')}
      >
        {label}
      </label>
      {description && (
        <span id={descriptionId} className="text-body-sm text-foreground-muted">
          {description}
        </span>
      )}
    </span>
  )

  return (
    <div
      className={cn(
        'flex min-h-11 items-center gap-3',
        labelPosition === 'start' && 'justify-between',
        containerClassName,
      )}
    >
      {labelPosition === 'start' ? (
        <>
          {text}
          {control}
        </>
      ) : (
        <>
          {control}
          {text}
        </>
      )}
    </div>
  )
}

export default Switch
