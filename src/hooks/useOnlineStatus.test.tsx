import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

afterEach(() => vi.restoreAllMocks())

describe('useOnlineStatus', () => {
  it('returns the current navigator.onLine value', () => {
    setOnline(false)
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(false)
  })

  it('updates on offline and online events', () => {
    setOnline(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    setOnline(false)
    act(() => void window.dispatchEvent(new Event('offline')))
    expect(result.current).toBe(false)

    setOnline(true)
    act(() => void window.dispatchEvent(new Event('online')))
    expect(result.current).toBe(true)
  })

  it('removes its listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    renderHook(() => useOnlineStatus()).unmount()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
