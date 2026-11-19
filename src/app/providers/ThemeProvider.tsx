import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { DEFAULT_THEME_PREFERENCE, THEME_META_COLORS, THEME_STORAGE_KEY } from '@/constants/theme'
import { usePersistentState } from '@/hooks/usePersistentState'
import { ThemeContext, type ThemeContextValue } from '@/hooks/useTheme'
import type { ResolvedTheme, ThemePreference } from '@/types/theme'
import { stringSerializer, type StorageSerializer } from '@/utils/storage'
import { isThemePreference } from '@/utils/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

// Stored as a plain string ("light" | "dark" | "system") because the inline
// no-flash script in index.html reads it before React loads.
const themeSerializer = stringSerializer as StorageSerializer<ThemePreference>

function subscribeToSystemTheme(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
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

/**
 * Shared client state: the theme preference (persisted, synced across tabs)
 * and the resolved theme (follows the OS when the preference is "system").
 */
function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreference] = usePersistentState<ThemePreference>(
    THEME_STORAGE_KEY,
    DEFAULT_THEME_PREFERENCE,
    { validate: isThemePreference, serializer: themeSerializer },
  )
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light' as const)
  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

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
