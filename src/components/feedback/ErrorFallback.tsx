import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

export interface ErrorFallbackProps {
  title?: string
  description?: string
  /** Called by the primary "Try again" button. Omit when retrying can't help. */
  onRetry?: () => void
  retryLabel?: string
  /** Extra actions, e.g. a link back to the Dashboard. */
  secondaryAction?: ReactNode
  /** `page` fills the viewport; `section` sits inside existing layout. */
  variant?: 'page' | 'section'
  /** Move focus to the message when shown (use for route/app-level fallbacks). */
  focusOnMount?: boolean
  /** Use `h1` when the fallback replaces a whole page, so the page keeps a main heading. */
  headingLevel?: 'h1' | 'h2' | 'h3'
  /**
   * The caught error. Its name and message are shown only in development builds;
   * production users never see technical details.
   */
  error?: unknown
  className?: string
}

function describeForDevelopers(error: unknown): string | null {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  return null
}

/** Shared presentation for crashed views. Respects the theme via semantic tokens. */
function ErrorFallback({
  title = 'Something went wrong',
  description = 'An unexpected problem stopped this from loading. You can try again.',
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
  variant = 'section',
  focusOnMount = false,
  headingLevel: Heading = 'h2',
  error,
  className,
}: ErrorFallbackProps) {
  const headingId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const developerDetails = import.meta.env.DEV ? describeForDevelopers(error) : null

  useEffect(() => {
    if (focusOnMount) containerRef.current?.focus()
  }, [focusOnMount])

  return (
    <div
      ref={containerRef}
      role="alert"
      aria-labelledby={headingId}
      tabIndex={-1}
      className={cn(
        'flex flex-col items-center gap-4 text-center outline-none',
        variant === 'page' ? 'min-h-[70dvh] justify-center px-6 py-16' : 'rounded-card border border-border bg-surface px-6 py-12',
        className,
      )}
    >
      <span
        className="flex size-14 items-center justify-center rounded-card bg-danger-subtle text-danger [&_svg]:size-7"
        aria-hidden="true"
      >
        <TriangleAlert />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <Heading id={headingId} className="text-h3 text-foreground">
          {title}
        </Heading>
        <p className="text-body-sm text-foreground-muted">{description}</p>
      </div>
      {(onRetry || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {onRetry && (
            <Button onClick={onRetry} leftIcon={<RotateCcw aria-hidden="true" />}>
              {retryLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
      {developerDetails && (
        <details className="mt-2 w-full max-w-md rounded-sm bg-surface-muted p-3 text-left text-caption text-foreground-muted">
          <summary className="cursor-pointer font-medium">Technical details (development only)</summary>
          <pre className="mt-2 overflow-x-auto font-mono break-words whitespace-pre-wrap">{developerDetails}</pre>
        </details>
      )}
    </div>
  )
}

export default ErrorFallback
