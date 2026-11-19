import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ErrorFallback from '@/components/feedback/ErrorFallback'

describe('ErrorFallback', () => {
  it('moves focus to itself when focusOnMount is set (route/app level)', () => {
    render(<ErrorFallback focusOnMount onRetry={() => {}} />)
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })

  it('does not steal focus by default (section level)', () => {
    render(<ErrorFallback onRetry={() => {}} />)
    expect(document.activeElement).toBe(document.body)
  })

  it('uses an h2 by default and h1 when it replaces a whole page', () => {
    const { rerender } = render(<ErrorFallback />)
    expect(screen.getByRole('heading', { level: 2, name: 'Something went wrong' })).toBeTruthy()
    rerender(<ErrorFallback headingLevel="h1" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeTruthy()
  })

  it('omits the retry button when no retry is possible', () => {
    render(<ErrorFallback />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
