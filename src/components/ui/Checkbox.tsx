import { Check } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { FieldMessage } from '@/components/ui/FormField'
import { cn } from '@/utils/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  helperText?: ReactNode
  error?: ReactNode
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

/** Native checkbox with custom visuals. Space toggles it; the label is clickable. */
function Checkbox({
  label,
  helperText,
  error,
  id,
  disabled,
  className,
  containerClassName,
  ref,
  ...props
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId
  const messageId = `${checkboxId}-message`
  const hasMessage = Boolean(error || helperText)

  return (
    <div className={cn('flex items-start gap-3', containerClassName)}>
      {/* 24px box meets WCAG 2.2 target size; the label extends the clickable area */}
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cn(
            'peer focus-ring size-6 cursor-pointer appearance-none rounded-xs border-[1.5px] border-input bg-surface',
            'transition-colors duration-150 ease-standard hover:border-foreground-muted',
            'checked:border-primary-edge checked:bg-primary checked:hover:bg-primary-hover',
            'disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled',
            'aria-invalid:border-danger',
            className,
          )}
          {...props}
        />
        <Check
          className="pointer-events-none absolute size-4 text-primary-foreground opacity-0 transition-opacity duration-150 peer-checked:opacity-100 peer-disabled:text-disabled-foreground"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={checkboxId}
          className={cn(
            'cursor-pointer text-body-sm text-foreground leading-6',
            disabled && 'cursor-not-allowed text-disabled-foreground',
          )}
        >
          {label}
        </label>
        <FieldMessage id={messageId} helperText={helperText} error={error} />
      </div>
    </div>
  )
}

export default Checkbox
