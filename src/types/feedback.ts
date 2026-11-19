/**
 * A user-facing description of a recoverable error.
 * Produced by an adapter (e.g. services/api/error-feedback.ts) so that UI components
 * never need to know about the error source. Contains no technical details.
 */
export interface ErrorFeedback {
  title: string
  message: string
  /** Whether trying the same operation again could succeed. */
  canRetry: boolean
  /** `warning` for transient conditions (offline, timeout), `error` otherwise. */
  severity: 'error' | 'warning'
}
