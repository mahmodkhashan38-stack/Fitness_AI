import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

export interface LoadingStateProps {
  /** Visible and announced text, e.g. "Loading workouts…". */
  label?: string
  /**
   * - `inline`: next to other content (small spinner + text).
   * - `section`: fills a section; give it the expected height to avoid layout shift.
   * - `page`: centred in the main content area.
   */
  variant?: 'inline' | 'section' | 'page'
  className?: string
}

/**
 * One accessible loading indicator: a single polite status message,
 * with the spinner hidden from assistive technology (it is decorative).
 * Mark the region being loaded with `aria-busy="true"` while this is shown.
 * The spinner stops animating under `prefers-reduced-motion` (global rule in styles/base.css).
 */
function LoadingState({ label = 'Loading…', variant = 'section', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center text-foreground-muted',
        variant === 'inline' && 'gap-2 text-body-sm',
        variant === 'section' && 'min-h-40 flex-col justify-center gap-3 text-body-sm',
        variant === 'page' && 'min-h-[50dvh] flex-col justify-center gap-4 text-body',
        className,
      )}
    >
      <span className="text-accent">
        <Spinner size={variant === 'inline' ? 'sm' : 'lg'} label={null} />
      </span>
      <span>{label}</span>
    </div>
  )
}

export default LoadingState
