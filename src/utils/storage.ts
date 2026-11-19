/**
 * Safe access to localStorage.
 *
 * - Never throws: storage can be missing (SSR/tests), blocked (privacy settings),
 *   or full (QuotaExceededError). Reads then return `undefined`/`null`, writes return `false`.
 * - Stored values are untrusted: they are parsed defensively and validated before use.
 * - Only persist non-sensitive client preferences here (theme, UI choices).
 *   Never store tokens, passwords, health records or personal details in localStorage.
 */

export interface StorageSerializer<T> {
  parse: (raw: string) => unknown
  stringify: (value: T) => string
}

/** JSON (default) — for objects, numbers, booleans. */
export const jsonSerializer: StorageSerializer<unknown> = {
  parse: (raw) => JSON.parse(raw) as unknown,
  stringify: (value) => JSON.stringify(value),
}

/** Raw strings, stored as-is (e.g. the theme value read by the no-flash script). */
export const stringSerializer: StorageSerializer<string> = {
  parse: (raw) => raw,
  stringify: (value) => value,
}

/** Narrows an unknown stored value to `T`. */
export type Validator<T> = (value: unknown) => value is T

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    // Accessing localStorage throws a SecurityError when storage is blocked.
    return null
  }
}

export function readStorageItem(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStorageItem(key: string, value: string): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorageItem(key: string): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/**
 * Parses and validates a raw stored string.
 * Returns `undefined` for missing, unparsable or invalid values.
 */
export function parseStoredValue<T>(
  raw: string | null,
  validate: Validator<T>,
  serializer: StorageSerializer<T> = jsonSerializer as StorageSerializer<T>,
): T | undefined {
  if (raw === null) return undefined
  try {
    const parsed = serializer.parse(raw)
    return validate(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function readStoredValue<T>(
  key: string,
  validate: Validator<T>,
  serializer: StorageSerializer<T> = jsonSerializer as StorageSerializer<T>,
): T | undefined {
  return parseStoredValue(readStorageItem(key), validate, serializer)
}

export function writeStoredValue<T>(
  key: string,
  value: T,
  serializer: StorageSerializer<T> = jsonSerializer as StorageSerializer<T>,
): boolean {
  try {
    return writeStorageItem(key, serializer.stringify(value))
  } catch {
    // e.g. JSON.stringify on a circular structure
    return false
  }
}
