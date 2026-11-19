import type { ResolvedTheme, ThemePreference } from '@/types/theme'
import { createStrictContext } from '@/utils/create-strict-context'

export interface ThemeContextValue {
  /** What the user chose: light, dark or system. */
  preference: ThemePreference
  /** What is applied right now (system resolved to light or dark). */
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  /** Flips between light and dark (leaves `system`). */
  toggleTheme: () => void
}

/**
 * Theme context lives with its hook in the shared hooks layer so shared components
 * can read it without importing from `app/`. The provider is in app/providers.
 */
const [ThemeContext, useThemeContext] = createStrictContext<ThemeContextValue>('Theme')

export { ThemeContext }

export function useTheme(): ThemeContextValue {
  return useThemeContext()
}
