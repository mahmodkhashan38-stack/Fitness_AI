/**
 * End-to-end example of the FIT-6 conventions (test-only component):
 * useAsyncTask + LoadingState + ErrorAlert + getErrorFeedback, driving the
 * real FIT-5 API client with a mocked fetch.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ErrorAlert from '@/components/feedback/ErrorAlert'
import LoadingState from '@/components/feedback/LoadingState'
import Button from '@/components/ui/Button'
import { useAsyncTask } from '@/hooks/useAsyncTask'
import { createApiClient } from '@/services/api/client'
import { getErrorFeedback } from '@/services/api/error-feedback'
import type { FetchFunction } from '@/services/api/types'

type Responder = (init: RequestInit) => Promise<Response>

function makeClient(responder: Responder) {
  const fetch = vi.fn<FetchFunction>((_url, init) => responder(init))
  return { client: createApiClient({ baseUrl: 'https://api.test/v1', fetch, timeoutMs: 1_000 }), fetch }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

/** Resolves when the request's signal aborts, like a server that never answers. */
const never: Responder = (init) =>
  new Promise((_resolve, reject) =>
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
  )

function WorkoutList({ client }: { client: ReturnType<typeof makeClient>['client'] }) {
  const { state, run, retry, cancel } = useAsyncTask((signal) => client.get<{ name: string }[]>('/workouts', { signal }))
  useEffect(() => {
    void run()
  }, [run])

  const feedback = state.status === 'error' ? getErrorFeedback(state.error) : null

  return (
    <section aria-label="Workouts" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && (
        <>
          <LoadingState label="Loading workouts…" />
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </>
      )}
      {feedback && <ErrorAlert feedback={feedback} onRetry={() => void retry()} />}
      {state.status === 'success' && (
        <ul>
          {state.data.map((workout) => (
            <li key={workout.name}>{workout.name}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

const region = () => screen.getByRole('region', { name: 'Workouts' })

describe('async loading and error feedback (with the real API client)', () => {
  it('shows one loading status and aria-busy, then removes them when data arrives', async () => {
    let respond!: (response: Response) => void
    const { client } = makeClient(() => new Promise((resolve) => (respond = resolve)))
    render(<WorkoutList client={client} />)

    expect(region().getAttribute('aria-busy')).toBe('true')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('Loading workouts…')

    await act(async () => respond(json([{ name: 'Push Day' }])))
    expect(screen.queryByRole('status')).toBeNull()
    expect(region().getAttribute('aria-busy')).toBe('false')
    expect(screen.getByText('Push Day')).toBeTruthy()
  })

  it('network failure → offline message; Retry succeeds and removes the error', async () => {
    let calls = 0
    const { client, fetch } = makeClient(async () => {
      calls += 1
      if (calls === 1) throw new TypeError('Failed to fetch')
      return json([{ name: 'Leg Day' }])
    })
    render(<WorkoutList client={client} />)
    await act(async () => {})
    expect(screen.getByRole('alert').textContent).toContain('You appear to be offline')
    expect(fetch).toHaveBeenCalledTimes(1) // no automatic retry

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Leg Day')).toBeTruthy()
  })

  it('HTTP 500 → server message, without status code or response body', async () => {
    const { client } = makeClient(async () => json({ trace: 'NullPointerException at db.query' }, 500))
    render(<WorkoutList client={client} />)
    await act(async () => {})
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Something went wrong on our side')
    expect(alert.textContent).not.toContain('500')
    expect(alert.textContent).not.toContain('NullPointerException')
  })

  it('timeout → "taking too long", distinct from cancellation', async () => {
    vi.useFakeTimers()
    try {
      const { client } = makeClient(never)
      render(<WorkoutList client={client} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(screen.getByRole('alert').textContent).toContain('This is taking too long')
    } finally {
      vi.useRealTimers()
    }
  })

  it('user cancellation → no error shown, loading removed', async () => {
    const { client } = makeClient(never)
    render(<WorkoutList client={client} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(region().getAttribute('aria-busy')).toBe('false')
  })

  it('unmounting while loading aborts the request', async () => {
    let seen!: AbortSignal
    const { client } = makeClient((init) => {
      seen = init.signal!
      return never(init)
    })
    const { unmount } = render(<WorkoutList client={client} />)
    unmount()
    expect(seen.aborted).toBe(true)
  })
})
