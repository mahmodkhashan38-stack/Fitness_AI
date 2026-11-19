import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorAlert from '@/components/feedback/ErrorAlert'
import type { ErrorFeedback } from '@/types/feedback'

const retryable: ErrorFeedback = { title: 'This is taking too long', message: 'Please try again.', canRetry: true, severity: 'warning' }
const final: ErrorFeedback = { title: 'Access denied', message: 'No permission.', canRetry: false, severity: 'error' }

describe('ErrorAlert', () => {
  it('is announced as an alert with title and message', () => {
    render(<ErrorAlert feedback={retryable} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('This is taking too long')
    expect(alert.textContent).toContain('Please try again.')
    expect(alert.textContent).toContain('Warning:') // status conveyed in text, not colour only
  })

  it('shows Retry only when a callback exists and the error is retryable', () => {
    const { rerender } = render(<ErrorAlert feedback={retryable} />)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    rerender(<ErrorAlert feedback={final} onRetry={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    const onRetry = vi.fn()
    rerender(<ErrorAlert feedback={retryable} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('marks Retry busy while retrying and ignores extra clicks', () => {
    const onRetry = vi.fn()
    render(<ErrorAlert feedback={retryable} onRetry={onRetry} retrying />)
    const button = screen.getByRole('button', { name: /Retrying/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('can be dismissed', () => {
    const onDismiss = vi.fn()
    render(<ErrorAlert feedback={final} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
