import type { ThemePreference } from '@/types/theme'

/**
 * localStorage key for the theme preference.
 * Keep in sync with the inline no-flash script in index.html.
 */
export const THEME_STORAGE_KEY = 'fitness-ai-theme'

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system']

/** Browser UI colour (address bar etc.) per theme — matches the background token. */
export const THEME_META_COLORS = {
  light: '#F6F8F4',
  dark: '#0B0F0E',
} as const
