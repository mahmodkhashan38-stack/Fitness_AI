import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OfflineIndicator from '@/components/feedback/OfflineIndicator'

afterEach(() => vi.restoreAllMocks())

describe('OfflineIndicator', () => {
  it('renders an empty live region while online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    render(<OfflineIndicator />)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows the offline message inside the existing live region when the connection drops', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    render(<OfflineIndicator />)
    const region = screen.getByRole('status')

    onLine.mockReturnValue(false)
    act(() => void window.dispatchEvent(new Event('offline')))
    expect(screen.getByRole('status')).toBe(region) // same node: screen readers announce the change
    expect(region.textContent).toMatch(/you’re offline/i)

    onLine.mockReturnValue(true)
    act(() => void window.dispatchEvent(new Event('online')))
    expect(region.textContent).toBe('')
  })

  it('hides the icon from assistive technology', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<OfflineIndicator />)
    expect(screen.getByRole('status').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
