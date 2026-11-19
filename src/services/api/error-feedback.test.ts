import { describe, expect, it } from 'vitest'
import { getErrorFeedback, isCancellation } from '@/services/api/error-feedback'
import { ApiError } from '@/services/api/errors'

const SENSITIVE = ['/users/42/notes', 'alex@example.com', 'Bearer', 'SQLSTATE', 'stack', 'ECONNREFUSED']

function apiError(kind: ApiError['kind'], extra: Partial<{ status: number; body: unknown }> = {}) {
  return new ApiError({
    kind,
    method: 'GET',
    path: '/users/42/notes',
    message: 'GET /users/42/notes failed: ECONNREFUSED SQLSTATE alex@example.com Bearer stack',
    ...extra,
  })
}

const text = (feedback: ReturnType<typeof getErrorFeedback>) => `${feedback?.title} ${feedback?.message}`

describe('getErrorFeedback', () => {
  it('network failure: offline-style message, retryable warning', () => {
    const feedback = getErrorFeedback(apiError('network'))
    expect(feedback).toMatchObject({ title: 'You appear to be offline', canRetry: true, severity: 'warning' })
  })

  it('timeout: distinct, retryable message', () => {
    const feedback = getErrorFeedback(apiError('timeout'))
    expect(feedback).toMatchObject({ title: 'This is taking too long', canRetry: true, severity: 'warning' })
  })

  it.each([
    [400, 'Something needs your attention', false],
    [401, 'Please sign in again', false],
    [403, 'Access denied', false],
    [404, 'Not found', false],
    [422, 'Something needs your attention', false],
    [429, 'Please wait a moment', true],
    [500, 'Something went wrong on our side', true],
    [503, 'Something went wrong on our side', true],
  ])('HTTP %i → "%s" (retry: %s)', (status, title, canRetry) => {
    expect(getErrorFeedback(apiError('http', { status }))).toMatchObject({ title, canRetry })
  })

  it('invalid response data and configuration errors have their own messages', () => {
    expect(getErrorFeedback(apiError('parse'))?.title).toBe('Unexpected response')
    expect(getErrorFeedback(apiError('config'))).toMatchObject({ title: 'Not available yet', canRetry: false })
  })

  it('intentional cancellation is not an error (returns null)', () => {
    expect(getErrorFeedback(apiError('aborted'))).toBeNull()
    expect(getErrorFeedback(new DOMException('Aborted', 'AbortError'))).toBeNull()
    expect(isCancellation(apiError('aborted'))).toBe(true)
    expect(isCancellation(apiError('timeout'))).toBe(false) // a timeout is a failure, not a cancellation
  })

  it('unknown errors get a generic, retryable message', () => {
    expect(getErrorFeedback(new TypeError('x is undefined'))?.title).toBe('Something went wrong')
    expect(getErrorFeedback('string error')?.title).toBe('Something went wrong')
    expect(getErrorFeedback(undefined)?.canRetry).toBe(true)
  })

  it('never exposes technical or personal details from the error', () => {
    const errors = [
      apiError('network'),
      apiError('timeout'),
      apiError('parse'),
      apiError('config'),
      apiError('http', { status: 400, body: { message: 'SQLSTATE 23505 alex@example.com' } }),
      apiError('http', { status: 500, body: '<pre>stack trace</pre>' }),
      new Error('ECONNREFUSED alex@example.com Bearer abc'),
    ]
    for (const error of errors) {
      const shown = text(getErrorFeedback(error))
      for (const secret of SENSITIVE) expect(shown).not.toContain(secret)
      expect(shown).not.toMatch(/\b(4|5)\d\d\b/) // no raw status codes
    }
  })
})
