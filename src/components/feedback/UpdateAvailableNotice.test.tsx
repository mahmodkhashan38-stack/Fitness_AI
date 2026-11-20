import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UpdateAvailableNotice from '@/components/feedback/UpdateAvailableNotice'

describe('UpdateAvailableNotice', () => {
  it('is announced and offers reload and dismiss actions', () => {
    const onReload = vi.fn()
    const onDismiss = vi.fn()
    render(<UpdateAvailableNotice onReload={onReload} onDismiss={onDismiss} />)

    expect(screen.getByRole('status').textContent).toMatch(/new version of fitness ai is available/i)
    act(() => screen.getByRole('button', { name: 'Reload to update' }).click())
    expect(onReload).toHaveBeenCalledTimes(1)
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('blocks repeated reloads while updating', () => {
    const onReload = vi.fn()
    render(<UpdateAvailableNotice onReload={onReload} onDismiss={() => {}} reloading />)
    const button = screen.getByRole('button', { name: /updating/i })
    expect(button.getAttribute('aria-busy')).toBe('true')
    act(() => button.click())
    expect(onReload).not.toHaveBeenCalled()
  })
})
