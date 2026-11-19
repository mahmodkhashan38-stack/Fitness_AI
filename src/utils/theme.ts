import { THEME_PREFERENCES } from '@/constants/theme'
import type { ThemePreference } from '@/types/theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}
