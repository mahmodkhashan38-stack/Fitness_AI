import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAsyncTask, type AsyncTask } from '@/hooks/useAsyncTask'

/** A promise you resolve or reject from the test. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAsyncTask', () => {
  it('starts idle and does nothing until run', () => {
    const task = vi.fn(async () => 1)
    const { result } = renderHook(() => useAsyncTask(task))
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(task).not.toHaveBeenCalled()
  })

  it('success: idle → loading → success with data', async () => {
    const pending = deferred<string[]>()
    const { result } = renderHook(() => useAsyncTask(() => pending.promise))
    let running!: Promise<void>
    act(() => {
      running = result.current.run()
    })
    expect(result.current.state).toEqual({ status: 'loading' })
    await act(async () => {
      pending.resolve(['Push Day'])
      await running
    })
    expect(result.current.state).toEqual({ status: 'success', data: ['Push Day'] })
  })

  it('failure: loading → error, keeping the original error for mapping', async () => {
    const failure = new Error('boom')
    const { result } = renderHook(() =>
      useAsyncTask(async () => {
        throw failure
      }),
    )
    await act(() => result.current.run())
    expect(result.current.state).toEqual({ status: 'error', error: failure })
  })

  it('run never rejects, so callers need no try/catch', async () => {
    const { result } = renderHook(() =>
      useAsyncTask(async () => {
        throw new Error('boom')
      }),
    )
    await expect(act(() => result.current.run())).resolves.toBeUndefined()
  })

  it('retry re-runs with the last arguments, and success clears the previous error', async () => {
    let attempt = 0
    const task = vi.fn(async (_signal: AbortSignal, id: string) => {
      attempt += 1
      if (attempt === 1) throw new Error('first attempt fails')
      return `workout ${id}`
    })
    const { result } = renderHook(() => useAsyncTask(task))
    await act(() => result.current.run('w1'))
    expect(result.current.state.status).toBe('error')
    await act(() => result.current.retry())
    expect(task).toHaveBeenLastCalledWith(expect.any(AbortSignal), 'w1')
    expect(result.current.state).toEqual({ status: 'success', data: 'workout w1' }) // no stale error
  })

  it('retry before any run does nothing', async () => {
    const task = vi.fn(async () => 1)
    const { result } = renderHook(() => useAsyncTask(task))
    await act(() => result.current.retry())
    expect(task).not.toHaveBeenCalled()
  })

  it('out-of-order responses: the latest call wins and the older one is aborted', async () => {
    const slow = deferred<string>()
    const fast = deferred<string>()
    const signals: AbortSignal[] = []
    const { result } = renderHook(() =>
      useAsyncTask((signal: AbortSignal, query: string) => {
        signals.push(signal)
        return query === 'slow' ? slow.promise : fast.promise
      }),
    )
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.run('slow')
    })
    act(() => {
      second = result.current.run('fast')
    })
    expect(signals[0]!.aborted).toBe(true)
    await act(async () => {
      fast.resolve('fast result')
      await second
    })
    await act(async () => {
      slow.resolve('stale result') // arrives last but must be ignored
      await first
    })
    expect(result.current.state).toEqual({ status: 'success', data: 'fast result' })
  })

  it('a superseded call that fails does not show its error', async () => {
    const old = deferred<string>()
    const { result } = renderHook(() =>
      useAsyncTask((_signal: AbortSignal, which: string) => (which === 'old' ? old.promise : Promise.resolve('new'))),
    )
    let first!: Promise<void>
    act(() => {
      first = result.current.run('old')
    })
    await act(() => result.current.run('new'))
    await act(async () => {
      old.reject(new Error('late failure'))
      await first
    })
    expect(result.current.state).toEqual({ status: 'success', data: 'new' })
  })

  it('cancel aborts the request and returns to idle — not an error', async () => {
    let seen!: AbortSignal
    const { result } = renderHook(() =>
      useAsyncTask(
        (signal: AbortSignal) =>
          new Promise<string>((_resolve, reject) => {
            seen = signal
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )
    let running!: Promise<void>
    act(() => {
      running = result.current.run()
    })
    await act(async () => {
      result.current.cancel()
      await running
    })
    expect(seen.aborted).toBe(true)
    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('reset clears data and forgets the last arguments', async () => {
    const task = vi.fn(async () => 'data')
    const { result } = renderHook(() => useAsyncTask(task))
    await act(() => result.current.run())
    act(() => result.current.reset())
    expect(result.current.state).toEqual({ status: 'idle' })
    await act(() => result.current.retry())
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('unmount aborts the running call and never updates state afterwards', async () => {
    const pending = deferred<string>()
    let seen!: AbortSignal
    const errorSpy = vi.spyOn(console, 'error')
    const { result, unmount } = renderHook(() =>
      useAsyncTask((signal: AbortSignal) => {
        seen = signal
        return pending.promise
      }),
    )
    let running!: Promise<void>
    act(() => {
      running = result.current.run()
    })
    unmount()
    expect(seen.aborted).toBe(true)
    pending.resolve('too late')
    await running
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('uses the latest task function without changing run identity', async () => {
    const { result, rerender } = renderHook(({ value }) => useAsyncTask(async () => value), {
      initialProps: { value: 'first' },
    })
    const firstRun = result.current.run
    rerender({ value: 'second' })
    expect(result.current.run).toBe(firstRun)
    await act(() => result.current.run())
    expect(result.current.state).toEqual({ status: 'success', data: 'second' })
  })
})

describe('useAsyncTask with tasks that ignore the AbortSignal', () => {
  /** A task that never looks at its signal; each call is resolved/rejected manually by the test. */
  function signalIgnoringTask() {
    const calls: ReturnType<typeof deferred<string>>[] = []
    // Typed as a real task (signal + label) but deliberately never reads the signal.
    const task: AsyncTask<string, [string]> = () => {
      const call = deferred<string>()
      calls.push(call)
      return call.promise
    }
    return { task, calls }
  }

  it('three overlapping calls resolving in reverse order: only the newest result is ever shown', async () => {
    const { task, calls } = signalIgnoringTask()
    const { result } = renderHook(() => useAsyncTask(task))
    const runs: Promise<void>[] = []
    act(() => {
      runs.push(result.current.run('first'))
    })
    act(() => {
      runs.push(result.current.run('second'))
    })
    act(() => {
      runs.push(result.current.run('third'))
    })

    await act(async () => {
      calls[2]!.resolve('third result')
      await runs[2]
    })
    expect(result.current.state).toEqual({ status: 'success', data: 'third result' })

    await act(async () => {
      calls[1]!.resolve('second result') // late, ignored even though the task never aborted
      calls[0]!.reject(new Error('first failed late')) // late failure, also ignored
      await Promise.all(runs)
    })
    expect(result.current.state).toEqual({ status: 'success', data: 'third result' })
  })

  it('an older call finishing before the newer one does not show its result in between', async () => {
    const { task, calls } = signalIgnoringTask()
    const { result } = renderHook(() => useAsyncTask(task))
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.run('first')
    })
    act(() => {
      second = result.current.run('second')
    })
    await act(async () => {
      calls[0]!.resolve('stale result')
      await first
    })
    expect(result.current.state).toEqual({ status: 'loading' }) // still waiting for the newest call
    await act(async () => {
      calls[1]!.resolve('fresh result')
      await second
    })
    expect(result.current.state).toEqual({ status: 'success', data: 'fresh result' })
  })

  it('cancel stays idle even if the ignored task later resolves or rejects', async () => {
    const { task, calls } = signalIgnoringTask()
    const { result } = renderHook(() => useAsyncTask(task))
    let running!: Promise<void>
    act(() => {
      running = result.current.run('x')
    })
    act(() => result.current.cancel())
    await act(async () => {
      calls[0]!.resolve('arrived after cancel')
      await running
    })
    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('reset stays idle even if the ignored task later rejects', async () => {
    const { task, calls } = signalIgnoringTask()
    const { result } = renderHook(() => useAsyncTask(task))
    let running!: Promise<void>
    act(() => {
      running = result.current.run('x')
    })
    act(() => result.current.reset())
    await act(async () => {
      calls[0]!.reject(new Error('failed after reset'))
      await running
    })
    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('after unmount, an ignored task settling causes no state update or warning', async () => {
    const { task, calls } = signalIgnoringTask()
    const errorSpy = vi.spyOn(console, 'error')
    const { result, unmount } = renderHook(() => useAsyncTask(task))
    let running!: Promise<void>
    act(() => {
      running = result.current.run('x')
    })
    unmount()
    calls[0]!.reject(new Error('late failure'))
    await running
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
