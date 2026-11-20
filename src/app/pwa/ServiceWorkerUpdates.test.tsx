import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import ServiceWorkerUpdates, { UPDATE_CHECK_INTERVAL_MS } from '@/app/pwa/ServiceWorkerUpdates'

const pwa = vi.hoisted(() => ({
  options: undefined as RegisterSWOptions | undefined,
  updateServiceWorker: undefined as ((reload?: boolean) => Promise<void>) | undefined,
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterSWOptions) => {
    pwa.options = options
    return pwa.updateServiceWorker
  },
}))

function fakeRegistration(overrides: Partial<ServiceWorkerRegistration> = {}) {
  return { installing: null, update: vi.fn(() => Promise.resolve()), ...overrides } as unknown as ServiceWorkerRegistration & {
    update: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  pwa.options = undefined
  pwa.updateServiceWorker = vi.fn(() => Promise.resolve())
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ServiceWorkerUpdates', () => {
  it('registers immediately and renders nothing until an update is waiting', () => {
    const { container } = render(<ServiceWorkerUpdates />)
    expect(pwa.options?.immediate).toBe(true)
    expect(container.innerHTML).toBe('')
  })

  it('shows the notice when a new version is waiting and applies it only when the user reloads', () => {
    render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onNeedRefresh?.())

    expect(screen.getByRole('status').textContent).toMatch(/new version/i)
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()

    act(() => screen.getByRole('button', { name: 'Reload to update' }).click())
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: /updating/i }).getAttribute('aria-busy')).toBe('true')
  })

  it('can be dismissed without updating, and reappears for a later version', () => {
    render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onNeedRefresh?.())
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(screen.queryByRole('status')).toBeNull()
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()

    act(() => pwa.options?.onNeedRefresh?.())
    expect(screen.getByRole('status')).not.toBeNull()
  })

  it('does not announce "offline ready" (no unsolicited messages)', () => {
    const { container } = render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onOfflineReady?.())
    expect(container.innerHTML).toBe('')
  })

  it('checks for updates every hour while online', () => {
    vi.useFakeTimers()
    const registration = fakeRegistration()
    render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onRegisteredSW?.('/sw.js', registration))

    act(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1))
    expect(registration.update).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('checks for updates when the user returns to the app', () => {
    const registration = fakeRegistration()
    render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onRegisteredSW?.('/sw.js', registration))

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('skips checks while a new version is already installing and tolerates failed checks', () => {
    vi.useFakeTimers()
    const installing = fakeRegistration({ installing: {} as ServiceWorker })
    const { unmount } = render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onRegisteredSW?.('/sw.js', installing))
    act(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS))
    expect(installing.update).not.toHaveBeenCalled()
    unmount()

    const failing = fakeRegistration({ update: vi.fn(() => Promise.reject(new Error('offline'))) })
    render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onRegisteredSW?.('/sw.js', failing))
    expect(() => act(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS))).not.toThrow()
    expect(failing.update).toHaveBeenCalledTimes(1)
  })

  it('stops checking after unmount', () => {
    vi.useFakeTimers()
    const registration = fakeRegistration()
    const { unmount } = render(<ServiceWorkerUpdates />)
    act(() => pwa.options?.onRegisteredSW?.('/sw.js', registration))
    unmount()
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 3)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
  })
})
