import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePersistentState } from '@/hooks/usePersistentState'

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const KEY = 'fitness-ai-test-goal'

function dispatchStorage(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
}

describe('usePersistentState', () => {
  it('starts from the default and does not write it to storage', () => {
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    expect(result.current[0]).toBe(3)
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('initialises from a valid stored value', () => {
    window.localStorage.setItem(KEY, '5')
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    expect(result.current[0]).toBe(5)
  })

  it('falls back to the default for invalid JSON or invalid shape', () => {
    window.localStorage.setItem(KEY, '{broken')
    expect(renderHook(() => usePersistentState(KEY, 3, { validate: isNumber })).result.current[0]).toBe(3)
    window.localStorage.setItem(KEY, '"five"')
    expect(renderHook(() => usePersistentState(KEY, 3, { validate: isNumber })).result.current[0]).toBe(3)
  })

  it('updates state and persists it, including functional updates', () => {
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    act(() => result.current[1](4))
    expect(result.current[0]).toBe(4)
    expect(window.localStorage.getItem(KEY)).toBe('4')
    act(() => result.current[1]((previous) => previous + 1))
    expect(result.current[0]).toBe(5)
    expect(window.localStorage.getItem(KEY)).toBe('5')
  })

  it('keeps a stable setter between renders', () => {
    const { result, rerender } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    const firstSetter = result.current[1]
    rerender()
    expect(result.current[1]).toBe(firstSetter)
  })

  it('follows valid changes from other tabs and ignores invalid ones', () => {
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    act(() => dispatchStorage(KEY, '6'))
    expect(result.current[0]).toBe(6)
    act(() => dispatchStorage(KEY, 'garbage'))
    expect(result.current[0]).toBe(3)
    act(() => dispatchStorage('another-key', '9'))
    expect(result.current[0]).toBe(3)
  })

  it('resets to the default when storage is cleared in another tab', () => {
    window.localStorage.setItem(KEY, '8')
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    act(() => dispatchStorage(null, null))
    expect(result.current[0]).toBe(3)
  })

  it('can opt out of cross-tab sync', () => {
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber, syncAcrossTabs: false }))
    act(() => dispatchStorage(KEY, '6'))
    expect(result.current[0]).toBe(3)
  })

  it('keeps working in memory when writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const { result } = renderHook(() => usePersistentState(KEY, 3, { validate: isNumber }))
    expect(() => act(() => result.current[1](7))).not.toThrow()
    expect(result.current[0]).toBe(7)
  })
})
