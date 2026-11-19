import { LoaderCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

type SpinnerSize = 'sm' | 'md' | 'lg'

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-8',
}

export interface SpinnerProps {
  size?: SpinnerSize
  /** Announced to screen readers. Pass `null` when the spinner is decorative (e.g. inside a busy button). */
  label?: string | null
  className?: string
}

function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  const icon = (
    <LoaderCircle
      className={cn('shrink-0 animate-spin', sizeClasses[size], className)}
      aria-hidden="true"
      strokeWidth={2.25}
    />
  )

  if (label === null) return icon

  return (
    <span role="status" className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  )
}

export default Spinner
