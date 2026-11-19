/**
 * jsdom has no matchMedia. This installs a controllable stand-in for
 * `(prefers-color-scheme: dark)` so tests can simulate OS theme changes.
 */
type Listener = (event: MediaQueryListEvent) => void

let prefersDark = false
const listeners = new Set<Listener>()

export function installMatchMedia(initialDark: boolean) {
  prefersDark = initialDark
  listeners.clear()
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query.includes('dark') ? prefersDark : false
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList
}

/** Simulates the OS switching between light and dark. */
export function setSystemDark(dark: boolean) {
  prefersDark = dark
  listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent))
}
