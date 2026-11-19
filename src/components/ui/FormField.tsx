import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface FieldLabelProps {
  htmlFor: string
  children: ReactNode
  required?: boolean
  optional?: boolean
  className?: string
}

/** Visible label for a form control. Required fields get a text marker, not just colour. */
export function FieldLabel({ htmlFor, children, required, optional, className }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn('text-label text-foreground', className)}>
      {children}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      )}
      {optional && <span className="ml-1.5 font-normal text-foreground-muted">(optional)</span>}
    </label>
  )
}

interface FieldMessageProps {
  id: string
  helperText?: ReactNode
  error?: ReactNode
}

/** Helper text or error message, linked to the control through aria-describedby. */
export function FieldMessage({ id, helperText, error }: FieldMessageProps) {
  if (error) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-body-sm text-danger">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </p>
    )
  }

  if (helperText) {
    return (
      <p id={id} className="text-body-sm text-foreground-muted">
        {helperText}
      </p>
    )
  }

  return null
}
