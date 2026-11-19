import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncState } from '@/types/async'

/** An async operation that receives an AbortSignal it should pass to fetch/apiClient. */
export type AsyncTask<T, Args extends unknown[]> = (signal: AbortSignal, ...args: Args) => Promise<T>

export interface AsyncTaskControls<T, Args extends unknown[]> {
  state: AsyncState<T>
  /** Starts the task. A newer call supersedes (and aborts) any call still running. Never rejects. */
  run: (...args: Args) => Promise<void>
  /** Runs again with the arguments of the last `run`. Does nothing if `run` was never called. */
  retry: () => Promise<void>
  /** Aborts the running call and returns to `idle` (a cancellation is not an error). */
  cancel: () => void
  /** Aborts anything running and clears the state to `idle`. */
  reset: () => void
}

/**
 * Tracks one async operation as idle → loading → success | error.
 *
 * - Latest call wins: results of superseded calls are ignored and their signal is aborted.
 * - Errors are stored as-is (`unknown`); map them for display with `getErrorFeedback`.
 * - Starting a new call clears any previous error or data.
 * - On unmount the running call is aborted and no state is updated afterwards.
 * - No automatic retries: call `retry()` from a user action.
 */
export function useAsyncTask<T, Args extends unknown[] = []>(
  task: AsyncTask<T, Args>,
): AsyncTaskControls<T, Args> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' })

  const taskRef = useRef(task)
  useEffect(() => {
    taskRef.current = task
  })

  const controllerRef = useRef<AbortController | null>(null)
  const lastArgsRef = useRef<Args | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  const run = useCallback(async (...args: Args): Promise<void> => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    lastArgsRef.current = args

    // `isCurrent` is false once this call is superseded, cancelled or the component unmounted.
    const isCurrent = () => mountedRef.current && controllerRef.current === controller

    setState({ status: 'loading' })
    try {
      const data = await taskRef.current(controller.signal, ...args)
      if (isCurrent()) {
        controllerRef.current = null
        setState({ status: 'success', data })
      }
    } catch (error) {
      if (!isCurrent()) return
      controllerRef.current = null
      // Aborted by us (cancel) while still current → treat as cancellation, not failure.
      setState(controller.signal.aborted ? { status: 'idle' } : { status: 'error', error })
    }
  }, [])

  const retry = useCallback(async (): Promise<void> => {
    const args = lastArgsRef.current
    if (args) await run(...args)
  }, [run])

  const cancel = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return
    controllerRef.current = null
    controller.abort()
    setState({ status: 'idle' })
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    lastArgsRef.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, run, retry, cancel, reset }
}
