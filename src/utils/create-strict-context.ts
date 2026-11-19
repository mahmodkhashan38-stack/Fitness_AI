import { createContext, useContext, type Context } from 'react'

/**
 * Creates a context whose hook throws when used outside its provider,
 * instead of silently returning a default value.
 *
 * @example
 *   const [ThemeContext, useThemeContext] = createStrictContext<ThemeContextValue>('Theme')
 */
export function createStrictContext<T>(name: string): readonly [Context<T | null>, () => T] {
  const StrictContext = createContext<T | null>(null)
  StrictContext.displayName = `${name}Context`

  function useStrictContext(): T {
    const value = useContext(StrictContext)
    if (value === null) {
      throw new Error(`use${name} must be used inside <${name}Provider>.`)
    }
    return value
  }

  return [StrictContext, useStrictContext] as const
}
