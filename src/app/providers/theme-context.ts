import { createContext } from 'react'
import type { ResolvedTheme, ThemePreference } from '@/types/theme'

export interface ThemeContextValue {
  /** What the user chose: light, dark or system. */
  preference: ThemePreference
  /** What is applied right now (system resolved to light or dark). */
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  /** Flips between light and dark (leaves `system`). */
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
