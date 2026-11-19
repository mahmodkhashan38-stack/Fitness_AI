import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import {
  jsonSerializer,
  parseStoredValue,
  readStoredValue,
  writeStoredValue,
  type StorageSerializer,
  type Validator,
} from '@/utils/storage'

export interface PersistentStateOptions<T> {
  /** Rejects stored values that don't match the expected shape (they fall back to the default). */
  validate: Validator<T>
  /** Defaults to JSON. Use `stringSerializer` for plain strings. */
  serializer?: StorageSerializer<T>
  /** Follow changes made in other tabs/windows. Defaults to true. */
  syncAcrossTabs?: boolean
}

/**
 * `useState` that is initialised from and saved to localStorage.
 *
 * - Reads once on mount; invalid or unavailable storage falls back to `defaultValue`.
 * - Writes only when the value is changed through the setter (the default is never written).
 * - Keeps working in memory when storage is blocked.
 * - `key` must be stable for the lifetime of the component.
 *
 * For non-sensitive client preferences only (see utils/storage.ts).
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  { validate, serializer = jsonSerializer as StorageSerializer<T>, syncAcrossTabs = true }: PersistentStateOptions<T>,
): [T, (next: SetStateAction<T>) => void] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, validate, serializer) ?? defaultValue)
  const hasPendingWrite = useRef(false)

  // Keep the latest options in refs so the setter and listener stay stable.
  const defaultRef = useRef(defaultValue)
  const validateRef = useRef(validate)
  const serializerRef = useRef(serializer)
  useEffect(() => {
    defaultRef.current = defaultValue
    validateRef.current = validate
    serializerRef.current = serializer
  })

  const setPersistentValue = useCallback((next: SetStateAction<T>) => {
    hasPendingWrite.current = true
    setValue(next)
  }, [])

  useEffect(() => {
    if (!hasPendingWrite.current) return
    hasPendingWrite.current = false
    writeStoredValue(key, value, serializerRef.current)
  }, [key, value])

  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      // key === null means storage was cleared.
      if (event.key !== null && event.key !== key) return
      const next = parseStoredValue(event.newValue, validateRef.current, serializerRef.current)
      hasPendingWrite.current = false // the other tab already saved it
      setValue(next ?? defaultRef.current)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, syncAcrossTabs])

  return [value, setPersistentValue]
}
