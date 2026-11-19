import { RotateCcw } from 'lucide-react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import type { ErrorFeedback } from '@/types/feedback'

export interface ErrorAlertProps {
  feedback: ErrorFeedback
  /** Shows a Retry button when provided and the error is retryable. Never retries automatically. */
  onRetry?: () => void
  /** Disables the Retry button while a retry is running. */
  retrying?: boolean
  onDismiss?: () => void
  className?: string
}

/**
 * Inline, announced message for a recoverable error.
 * Takes UI-ready `ErrorFeedback`, so it has no dependency on where the error came from.
 */
function ErrorAlert({ feedback, onRetry, retrying = false, onDismiss, className }: ErrorAlertProps) {
  const showRetry = Boolean(onRetry) && feedback.canRetry

  return (
    <Alert
      variant={feedback.severity === 'warning' ? 'warning' : 'danger'}
      title={feedback.title}
      live
      onDismiss={onDismiss}
      className={className}
      action={
        showRetry ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            loading={retrying}
            loadingText="Retrying…"
            leftIcon={<RotateCcw aria-hidden="true" />}
          >
            Try again
          </Button>
        ) : undefined
      }
    >
      {feedback.message}
    </Alert>
  )
}

export default ErrorAlert
