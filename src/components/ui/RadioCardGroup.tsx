import { Check } from 'lucide-react'
import { useId, type ReactNode, type Ref } from 'react'
import { FieldMessage } from '@/components/ui/FormField'
import { cn } from '@/utils/cn'

export interface RadioCardOption {
  value: string
  label: string
  description?: string
}

export interface RadioCardGroupProps {
  /** Visible group label (the fieldset legend); also the accessible name. */
  legend: string
  name: string
  options: readonly RadioCardOption[]
  /** Selected value, or '' for none. */
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  helperText?: ReactNode
  error?: ReactNode
  /** Grid columns from the small breakpoint up (always one column on narrow phones unless `compact`). */
  columns?: 1 | 2 | 4
  /** Small square options in one row (e.g. numbers 0–7). */
  compact?: boolean
  className?: string
  /** Points at the selected option, or the first one: used to move focus to the group on errors. */
  ref?: Ref<HTMLInputElement>
}

const columnClasses = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 4: 'sm:grid-cols-4' } as const

/**
 * Single choice shown as selectable cards. Built on native radio inputs, so arrow keys,
 * Space, form semantics and screen readers ("radio, 2 of 4, checked") work as usual.
 */
function RadioCardGroup({
  legend,
  name,
  options,
  value,
  onChange,
  required,
  disabled,
  helperText,
  error,
  columns = 2,
  compact = false,
  className,
  ref,
}: RadioCardGroupProps) {
  const groupId = useId()
  const messageId = `${groupId}-message`
  const hasMessage = Boolean(error || helperText)
  const focusTarget = options.some((option) => option.value === value) ? value : options[0]?.value

  return (
    <fieldset
      className={cn('flex min-w-0 flex-col gap-2', className)}
      aria-describedby={hasMessage ? messageId : undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="mb-1.5 text-label text-foreground">
        {legend}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className={cn('grid gap-2', compact ? 'grid-cols-4 min-[400px]:grid-cols-8' : cn('grid-cols-1', columnClasses[columns]))}>
        {options.map((option) => {
          const checked = option.value === value
          const labelId = `${groupId}-${option.value}-label`
          const descriptionId = option.description ? `${groupId}-${option.value}-description` : undefined
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex cursor-pointer rounded-control border transition-[border-color,background-color,box-shadow] duration-150 ease-standard',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                checked
                  ? compact
                    ? 'border-primary-edge bg-primary'
                    : 'border-primary-edge bg-primary-subtle'
                  : 'border-input bg-surface hover:border-foreground-muted',
                error && !checked && 'border-danger hover:border-danger',
                compact ? 'h-11 items-center justify-center' : 'min-h-11 items-start gap-3 px-3.5 py-3',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                ref={option.value === focusTarget ? ref : undefined}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                required={required}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              {compact ? (
                <span id={labelId} className={cn('numeric text-body font-semibold', checked ? 'text-primary-foreground' : 'text-foreground-muted')}>
                  {option.label}
                </span>
              ) : (
                <>
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
                      checked ? 'border-primary-edge bg-primary text-primary-foreground' : 'border-input bg-surface',
                    )}
                    aria-hidden="true"
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span id={labelId} className="text-body font-medium text-foreground">
                      {option.label}
                    </span>
                    {option.description && (
                      <span id={descriptionId} className="text-body-sm text-foreground-muted">
                        {option.description}
                      </span>
                    )}
                  </span>
                </>
              )}
            </label>
          )
        })}
      </div>
      <FieldMessage id={messageId} helperText={helperText} error={error} />
    </fieldset>
  )
}

export default RadioCardGroup
