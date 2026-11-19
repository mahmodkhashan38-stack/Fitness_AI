import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'
import { FieldLabel, FieldMessage } from '@/components/ui/FormField'
import { controlClasses } from '@/components/ui/form-styles'
import { cn } from '@/utils/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hideLabel?: boolean
  helperText?: ReactNode
  error?: ReactNode
  containerClassName?: string
  ref?: Ref<HTMLTextAreaElement>
}

function Textarea({
  label,
  hideLabel,
  helperText,
  error,
  id,
  required,
  rows = 4,
  className,
  containerClassName,
  ref,
  ...props
}: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const messageId = `${textareaId}-message`
  const hasMessage = Boolean(error || helperText)

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <FieldLabel htmlFor={textareaId} required={required} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </FieldLabel>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={cn(controlClasses, 'min-h-24 resize-y px-3.5 py-3 leading-relaxed', className)}
        {...props}
      />
      <FieldMessage id={messageId} helperText={helperText} error={error} />
    </div>
  )
}

export default Textarea
