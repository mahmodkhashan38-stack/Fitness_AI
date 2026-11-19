import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import ThemeProvider from '@/app/providers/ThemeProvider'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { THEME_STORAGE_KEY } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'
import { installMatchMedia, setSystemDark } from '@/test/match-media'

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>
const isDarkApplied = () => document.documentElement.classList.contains('dark')

describe('ThemeProvider (behaviour preserved after the FIT-4 refactor)', () => {
  it('defaults to "system", follows the OS, and stores nothing', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.preference).toBe('system')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(isDarkApplied()).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('reacts live to OS changes while on "system"', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.resolvedTheme).toBe('light')
    act(() => setSystemDark(true))
    expect(result.current.resolvedTheme).toBe('dark')
    expect(isDarkApplied()).toBe(true)
  })

  it('persists the preference as a plain string (format read by the index.html no-flash script)', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setPreference('dark'))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(isDarkApplied()).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('restores a saved preference on startup, ignoring the OS', () => {
    installMatchMedia(true)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.preference).toBe('light')
    expect(isDarkApplied()).toBe(false)
  })

  it('ignores an invalid stored value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.preference).toBe('system')
  })

  it('toggleTheme flips the resolved theme and saves it', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.toggleTheme())
    expect(result.current.preference).toBe('dark')
    act(() => result.current.toggleTheme())
    expect(result.current.preference).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('syncs a change made in another tab', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }))
    })
    expect(result.current.preference).toBe('dark')
  })

  it('drives the shared ThemeToggle component', () => {
    render(<ThemeToggle />, { wrapper })
    act(() => screen.getByRole('radio', { name: 'Dark' }).click())
    expect(isDarkApplied()).toBe(true)
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true)
  })

  it('throws a clear error when useTheme is used without the provider', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used inside <ThemeProvider>.')
  })
})
