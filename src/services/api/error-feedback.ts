import { isApiError } from '@/services/api/errors'
import type { ErrorFeedback } from '@/types/feedback'

const GENERIC: ErrorFeedback = {
  title: 'Something went wrong',
  message: 'Please try again. If the problem continues, try again later.',
  canRetry: true,
  severity: 'error',
}

/** True for intentional cancellations (caller aborted), which are not failures. */
export function isCancellation(error: unknown): boolean {
  if (isApiError(error)) return error.kind === 'aborted'
  return error instanceof DOMException && error.name === 'AbortError'
}

function feedbackForStatus(status: number): ErrorFeedback {
  if (status === 401) {
    return { title: 'Please sign in again', message: 'Your session is no longer valid.', canRetry: false, severity: 'error' }
  }
  if (status === 403) {
    return { title: 'Access denied', message: 'You don’t have permission to do this.', canRetry: false, severity: 'error' }
  }
  if (status === 404) {
    return { title: 'Not found', message: 'We couldn’t find what you were looking for.', canRetry: false, severity: 'error' }
  }
  if (status === 408 || status === 429) {
    return {
      title: 'Please wait a moment',
      message: 'The server is busy. Try again in a few seconds.',
      canRetry: true,
      severity: 'warning',
    }
  }
  if (status >= 400 && status < 500) {
    return {
      title: 'Something needs your attention',
      message: 'The request couldn’t be completed. Check the details and try again.',
      canRetry: false,
      severity: 'error',
    }
  }
  return {
    title: 'Something went wrong on our side',
    message: 'This isn’t your fault. Please try again shortly.',
    canRetry: true,
    severity: 'error',
  }
}

/**
 * Maps any thrown value to safe, user-facing copy.
 * Returns `null` for cancellations, which should not be shown as errors.
 *
 * Never includes error messages, URLs, status codes or response bodies:
 * those can contain technical or personal details. Features that need
 * field-level validation messages should read `ApiError.body` themselves.
 */
export function getErrorFeedback(error: unknown): ErrorFeedback | null {
  if (isCancellation(error)) return null
  if (!isApiError(error)) return GENERIC

  switch (error.kind) {
    case 'network':
      return {
        title: 'You appear to be offline',
        message: 'We couldn’t reach the server. Check your connection and try again.',
        canRetry: true,
        severity: 'warning',
      }
    case 'timeout':
      return {
        title: 'This is taking too long',
        message: 'The server didn’t respond in time. Please try again.',
        canRetry: true,
        severity: 'warning',
      }
    case 'http':
      return error.status === undefined ? GENERIC : feedbackForStatus(error.status)
    case 'parse':
      return {
        title: 'Unexpected response',
        message: 'We received data we couldn’t read. Please try again later.',
        canRetry: true,
        severity: 'error',
      }
    case 'config':
      return {
        title: 'Not available yet',
        message: 'This feature isn’t connected to a server yet.',
        canRetry: false,
        severity: 'error',
      }
    case 'aborted':
      return null
  }
}
