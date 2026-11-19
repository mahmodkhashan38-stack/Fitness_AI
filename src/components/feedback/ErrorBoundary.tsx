import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorFallback from '@/components/feedback/ErrorFallback'

export interface ErrorBoundaryFallbackProps {
  error: unknown
  /** Clears the error and renders the children again. */
  reset: () => void
}

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback: an element, or a render function receiving the error and `reset`. */
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode)
  /** When any value changes (e.g. the route path), a shown error is cleared automatically. */
  resetKeys?: readonly unknown[]
  /** Hook for reporting (e.g. a future monitoring service). Never log sensitive data. */
  onError?: (error: unknown, info: ErrorInfo) => void
  /** Called after the boundary resets. */
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: unknown
}

const changed = (a: readonly unknown[] = [], b: readonly unknown[] = []) =>
  a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]))

/**
 * Catches errors thrown while rendering its children (render, lifecycle methods,
 * constructors) and shows a fallback instead of unmounting the whole app.
 *
 * It does NOT catch errors in event handlers, in async code (promises, timers,
 * fetch), or in the boundary itself. Handle those with try/catch and show them
 * with <ErrorAlert> (see docs/architecture.md).
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  override componentDidUpdate(previousProps: ErrorBoundaryProps): void {
    if (this.state.hasError && changed(previousProps.resetKeys, this.props.resetKeys)) {
      this.reset()
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    const { fallback } = this.props
    if (typeof fallback === 'function') return fallback({ error: this.state.error, reset: this.reset })
    if (fallback !== undefined) return fallback
    return <ErrorFallback error={this.state.error} onRetry={this.reset} />
  }
}

export default ErrorBoundary
