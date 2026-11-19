import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LoadingState from '@/components/feedback/LoadingState'
import RouteLoader from '@/components/layout/RouteLoader'

describe('LoadingState', () => {
  it.each(['inline', 'section', 'page'] as const)('%s: one polite status with the visible label', (variant) => {
    render(<LoadingState variant={variant} label="Loading workouts…" />)
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(1) // the spinner itself is not a second announcement
    expect(statuses[0]!.getAttribute('aria-live')).toBe('polite')
    expect(statuses[0]!.textContent).toBe('Loading workouts…')
    expect(statuses[0]!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('section variant reserves height to limit layout shift', () => {
    render(<LoadingState variant="section" />)
    expect(screen.getByRole('status').className).toContain('min-h-40')
  })

  it('the lazy-route fallback uses the same pattern', () => {
    render(<RouteLoader />)
    expect(screen.getByRole('status').textContent).toBe('Loading page…')
  })
})
