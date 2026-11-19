import { describe, expect, it, vi } from 'vitest'
import {
  readStorageItem,
  readStoredValue,
  removeStorageItem,
  stringSerializer,
  writeStorageItem,
  writeStoredValue,
} from '@/utils/storage'

interface Prefs {
  units: 'metric' | 'imperial'
  weeklyGoal: number
}
const isPrefs = (value: unknown): value is Prefs =>
  typeof value === 'object' &&
  value !== null &&
  ((value as Prefs).units === 'metric' || (value as Prefs).units === 'imperial') &&
  typeof (value as Prefs).weeklyGoal === 'number'

const isString = (value: unknown): value is string => typeof value === 'string'

describe('storage utilities', () => {
  it('round-trips valid JSON values', () => {
    expect(writeStoredValue<Prefs>('prefs', { units: 'metric', weeklyGoal: 4 })).toBe(true)
    expect(window.localStorage.getItem('prefs')).toBe('{"units":"metric","weeklyGoal":4}')
    expect(readStoredValue('prefs', isPrefs)).toEqual({ units: 'metric', weeklyGoal: 4 })
  })

  it('returns undefined for a missing key', () => {
    expect(readStoredValue('missing', isPrefs)).toBeUndefined()
  })

  it('returns undefined for invalid JSON instead of throwing', () => {
    window.localStorage.setItem('prefs', '{not json')
    expect(() => readStoredValue('prefs', isPrefs)).not.toThrow()
    expect(readStoredValue('prefs', isPrefs)).toBeUndefined()
  })

  it('returns undefined when stored JSON fails validation', () => {
    window.localStorage.setItem('prefs', JSON.stringify({ units: 'parsecs', weeklyGoal: 'four' }))
    expect(readStoredValue('prefs', isPrefs)).toBeUndefined()
  })

  it('stores plain strings unchanged with the string serializer', () => {
    writeStoredValue('theme', 'dark', stringSerializer)
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(readStoredValue('theme', isString, stringSerializer)).toBe('dark')
  })

  it('reports failure (without throwing) when a value cannot be serialised', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(writeStoredValue('circular', circular)).toBe(false)
  })

  it('removes items', () => {
    writeStorageItem('k', 'v')
    expect(removeStorageItem('k')).toBe(true)
    expect(readStorageItem('k')).toBeNull()
  })

  it('degrades gracefully when localStorage access is blocked (SecurityError)', () => {
    const original =
      Object.getOwnPropertyDescriptor(window, 'localStorage') ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError')
      },
    })
    try {
      expect(readStorageItem('k')).toBeNull()
      expect(writeStorageItem('k', 'v')).toBe(false)
      expect(removeStorageItem('k')).toBe(false)
      expect(readStoredValue('k', isPrefs)).toBeUndefined()
    } finally {
      // Restore jsdom's real storage for the following tests.
      if (original) Object.defineProperty(window, 'localStorage', original)
    }
  })

  it('returns false when the quota is exceeded', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(writeStorageItem('k', 'v')).toBe(false)
    expect(writeStoredValue('k', { a: 1 })).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})
