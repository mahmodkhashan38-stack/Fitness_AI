import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ThemeContext, type ThemeContextValue } from '@/app/providers/theme-context'
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_META_COLORS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from '@/constants/theme'
import type { ResolvedTheme, ThemePreference } from '@/types/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

function writeStoredPreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The theme still applies for this session.
  }
}

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement

  // Briefly disable transitions so every surface switches at once.
  root.classList.add('theme-switching')
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme

  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', THEME_META_COLORS[theme]))

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.remove('theme-switching'))
  })
}

interface ThemeProviderProps {
  children: ReactNode
}

function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light' as const)
  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setPreferenceState(isThemePreference(event.newValue) ? event.newValue : DEFAULT_THEME_PREFERENCE)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writeStoredPreference(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setPreference])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference, toggleTheme }),
    [preference, resolvedTheme, setPreference, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default ThemeProvider
