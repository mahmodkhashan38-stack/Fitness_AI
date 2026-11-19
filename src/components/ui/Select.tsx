import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'
import { FieldLabel, FieldMessage } from '@/components/ui/FormField'
import { controlClasses } from '@/components/ui/form-styles'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string
  options: readonly SelectOption[]
  /** Shown as an empty, non-selectable first option. */
  placeholder?: string
  hideLabel?: boolean
  helperText?: ReactNode
  error?: ReactNode
  containerClassName?: string
  ref?: Ref<HTMLSelectElement>
}

/** Native <select> for full keyboard, screen-reader and mobile-picker support. */
function Select({
  label,
  options,
  placeholder,
  hideLabel,
  helperText,
  error,
  id,
  required,
  className,
  containerClassName,
  defaultValue,
  value,
  ref,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const messageId = `${selectId}-message`
  const hasMessage = Boolean(error || helperText)
  const isControlled = value !== undefined

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <FieldLabel htmlFor={selectId} required={required} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          value={value}
          defaultValue={isControlled ? undefined : (defaultValue ?? (placeholder ? '' : undefined))}
          className={cn(controlClasses, 'h-11 cursor-pointer appearance-none pr-10 pl-3.5', className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3.5 size-[1.125rem] -translate-y-1/2 text-foreground-muted"
          aria-hidden="true"
        />
      </div>
      <FieldMessage id={messageId} helperText={helperText} error={error} />
    </div>
  )
}

export default Select
