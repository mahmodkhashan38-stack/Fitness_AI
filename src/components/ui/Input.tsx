import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { FieldLabel, FieldMessage } from '@/components/ui/FormField'
import { controlClasses } from '@/components/ui/form-styles'
import { cn } from '@/utils/cn'

type InputSize = 'md' | 'lg'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean
  helperText?: ReactNode
  error?: ReactNode
  /** Icon shown at the start of the field. */
  leadingIcon?: ReactNode
  /** Short unit or text shown at the end, e.g. "kg" or "kcal". */
  suffix?: string
  size?: InputSize
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

function Input({
  label,
  hideLabel,
  helperText,
  error,
  leadingIcon,
  suffix,
  size = 'md',
  id,
  required,
  className,
  containerClassName,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const hasMessage = Boolean(error || helperText)

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <FieldLabel htmlFor={inputId} required={required} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </FieldLabel>
      <div className="relative flex items-center">
        {leadingIcon && (
          <span
            className="pointer-events-none absolute left-3.5 flex text-foreground-muted [&_svg]:size-[1.125rem]"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cn(
            controlClasses,
            size === 'lg' ? 'h-13 px-4' : 'h-11 px-3.5',
            leadingIcon && 'pl-10',
            suffix && 'pr-14',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute right-3.5 text-body-sm font-medium text-foreground-muted"
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}
      </div>
      <FieldMessage id={messageId} helperText={helperText} error={error} />
    </div>
  )
}

export default Input
