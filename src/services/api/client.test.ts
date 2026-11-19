import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, createApiClient, DEFAULT_TIMEOUT_MS } from '@/services/api/client'
import { ApiError, isApiError } from '@/services/api/errors'
import type { FetchFunction } from '@/services/api/types'

const BASE = 'https://api.test.local/v1'

type FetchCall = { url: string; init: RequestInit }

/** Creates a fetch mock that records calls and answers with `respond`. */
function mockFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = []
  const fetch = vi.fn<FetchFunction>(async (url, init) => {
    const call = { url, init }
    calls.push(call)
    return respond(call)
  })
  return { fetch, calls }
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  })
}

/** A fetch that never resolves until its signal aborts, like a hung server. */
const hangingFetch: FetchFunction = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
  })

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error('Expected the request to fail')
}

const headerOf = (call: FetchCall, name: string) => new Headers(call.init.headers).get(name)

afterEach(() => {
  vi.useRealTimers()
})

describe('apiClient – methods and request building', () => {
  it('GET: calls base URL + path, sends Accept JSON and no body', async () => {
    const { fetch, calls } = mockFetch(() => json({ ok: true }))
    const client = createApiClient({ baseUrl: BASE, fetch })
    await client.get('/workouts')
    expect(calls[0]!.url).toBe(`${BASE}/workouts`)
    expect(calls[0]!.init.method).toBe('GET')
    expect(calls[0]!.init.body).toBeUndefined()
    expect(headerOf(calls[0]!, 'Accept')).toBe('application/json')
    expect(headerOf(calls[0]!, 'Content-Type')).toBeNull()
  })

  it('POST: serialises the body as JSON with a JSON content type', async () => {
    const { fetch, calls } = mockFetch(() => json({ id: 'w1' }, { status: 201 }))
    const client = createApiClient({ baseUrl: BASE, fetch })
    const result = await client.post<{ id: string }>('/workouts', { body: { name: 'Push Day', exercises: [] } })
    expect(result).toEqual({ id: 'w1' })
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.body).toBe('{"name":"Push Day","exercises":[]}')
    expect(headerOf(calls[0]!, 'Content-Type')).toBe('application/json')
  })

  it.each(['PUT', 'PATCH'] as const)('%s: sends the method and JSON body', async (method) => {
    const { fetch, calls } = mockFetch(() => json({ updated: true }))
    const client = createApiClient({ baseUrl: BASE, fetch })
    const send = method === 'PUT' ? client.put : client.patch
    await expect(send('/workouts/w1', { body: { name: 'Pull Day' } })).resolves.toEqual({ updated: true })
    expect(calls[0]!.init.method).toBe(method)
    expect(calls[0]!.init.body).toBe('{"name":"Pull Day"}')
  })

  it('DELETE: sends the method and handles 204 No Content', async () => {
    const { fetch, calls } = mockFetch(() => new Response(null, { status: 204 }))
    const client = createApiClient({ baseUrl: BASE, fetch })
    await expect(client.delete<void>('/workouts/w1')).resolves.toBeUndefined()
    expect(calls[0]!.init.method).toBe('DELETE')
  })

  it('encodes query parameters, repeats arrays and skips null/undefined', async () => {
    const { fetch, calls } = mockFetch(() => json([]))
    const client = createApiClient({ baseUrl: BASE, fetch })
    await client.get('/foods', {
      query: { q: 'greek yogurt & honey', page: 2, verified: true, tag: ['high-protein', 'low fat'], cursor: null, sort: undefined },
    })
    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe('/v1/foods')
    expect(url.searchParams.get('q')).toBe('greek yogurt & honey')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('verified')).toBe('true')
    expect(url.searchParams.getAll('tag')).toEqual(['high-protein', 'low fat'])
    expect(url.searchParams.has('cursor')).toBe(false)
    expect(url.searchParams.has('sort')).toBe(false)
    expect(calls[0]!.url).toContain('q=greek+yogurt+%26+honey')
  })

  it('omits the "?" when every query value is empty', async () => {
    const { fetch, calls } = mockFetch(() => json([]))
    await createApiClient({ baseUrl: BASE, fetch }).get('/foods', { query: { cursor: null } })
    expect(calls[0]!.url).toBe(`${BASE}/foods`)
  })

  it('sends custom headers and lets them override defaults', async () => {
    const { fetch, calls } = mockFetch(() => json({}))
    const client = createApiClient({ baseUrl: BASE, fetch })
    await client.get('/me', { headers: { 'X-Request-Source': 'web', Accept: 'application/vnd.fitness+json' } })
    expect(headerOf(calls[0]!, 'X-Request-Source')).toBe('web')
    expect(headerOf(calls[0]!, 'Accept')).toBe('application/vnd.fitness+json')
  })

  it('adds no Authorization header unless the caller provides one', async () => {
    const { fetch, calls } = mockFetch(() => json({}))
    const client = createApiClient({ baseUrl: BASE, fetch })
    await client.get('/me')
    expect(headerOf(calls[0]!, 'Authorization')).toBeNull()
    await client.get('/me', { headers: { Authorization: 'Bearer caller-supplied' } })
    expect(headerOf(calls[1]!, 'Authorization')).toBe('Bearer caller-supplied')
  })

  it('joins base URLs with trailing slashes and same-origin base paths', async () => {
    const { fetch, calls } = mockFetch(() => json({}))
    await createApiClient({ baseUrl: `${BASE}/`, fetch }).get('/a')
    await createApiClient({ baseUrl: '/api', fetch }).get('/b')
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/a`, '/api/b'])
  })

  it('rejects absolute or protocol-relative paths so requests cannot leave the API origin', async () => {
    const { fetch } = mockFetch(() => json({}))
    const client = createApiClient({ baseUrl: BASE, fetch })
    for (const path of ['https://evil.example/steal', '//evil.example/steal', 'workouts']) {
      const error = await captureError(client.get(path))
      expect(error.kind).toBe('config')
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('apiClient – responses', () => {
  it('returns parsed JSON for a successful response (including +json media types)', async () => {
    const { fetch } = mockFetch(() =>
      json({ id: 'u1', name: 'Alex' }, { headers: { 'Content-Type': 'application/problem+json; charset=utf-8' } }),
    )
    await expect(createApiClient({ baseUrl: BASE, fetch }).get('/me')).resolves.toEqual({ id: 'u1', name: 'Alex' })
  })

  it('returns undefined for 204 and for a 200 with an empty body', async () => {
    const responses = [new Response(null, { status: 204 }), new Response('', { status: 200 })]
    const { fetch } = mockFetch(() => responses.shift()!)
    const client = createApiClient({ baseUrl: BASE, fetch })
    await expect(client.post('/sessions/s1/finish')).resolves.toBeUndefined()
    await expect(client.post('/sessions/s1/finish')).resolves.toBeUndefined()
  })

  it('reports malformed JSON as a parse error and keeps the status', async () => {
    const { fetch } = mockFetch(
      () => new Response('{"id": "w1",', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/workouts/w1'))
    expect(error.kind).toBe('parse')
    expect(error.status).toBe(200)
    expect(error.message).toBe('GET /workouts/w1 returned malformed JSON.')
    expect(error.cause).toBeInstanceOf(SyntaxError)
  })

  it('does not assume JSON: a non-JSON success response is a parse error, not a crash', async () => {
    const { fetch } = mockFetch(
      () => new Response('<!doctype html><title>Proxy</title>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/workouts'))
    expect(error.kind).toBe('parse')
    expect(error.message).toBe('GET /workouts returned text/html instead of JSON.')
  })

  it('treats a body without a content type as non-JSON', async () => {
    const { fetch } = mockFetch(() => {
      const response = new Response('{"a":1}', { status: 200 })
      response.headers.delete('Content-Type')
      return response
    })
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/x'))
    expect(error.kind).toBe('parse')
  })

  it('validates data with an optional parser and reports mismatches as parse errors', async () => {
    const isWorkoutList = (data: unknown): { id: string }[] => {
      if (!Array.isArray(data) || !data.every((item) => typeof (item as { id?: unknown }).id === 'string')) {
        throw new TypeError('Expected a list of workouts')
      }
      return data as { id: string }[]
    }
    const responses = [json([{ id: 'w1' }]), json({ unexpected: true })]
    const { fetch } = mockFetch(() => responses.shift()!)
    const client = createApiClient({ baseUrl: BASE, fetch })
    await expect(client.get('/workouts', { parse: isWorkoutList })).resolves.toEqual([{ id: 'w1' }])
    const error = await captureError(client.get('/workouts', { parse: isWorkoutList }))
    expect(error.kind).toBe('parse')
    expect(error.message).toBe('GET /workouts returned data in an unexpected shape.')
  })
})

describe('apiClient – HTTP errors', () => {
  it('400: keeps status and the JSON error body (e.g. validation details)', async () => {
    const problem = { message: 'Validation failed', fields: { reps: 'Must be at least 1' } }
    const { fetch } = mockFetch(() => json(problem, { status: 400, statusText: 'Bad Request' }))
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).post('/sets', { body: { reps: 0 } }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.kind).toBe('http')
    expect(error.status).toBe(400)
    expect(error.body).toEqual(problem)
    expect(error.isClientError).toBe(true)
    expect(error.isServerError).toBe(false)
    expect(error.message).toBe('POST /sets failed with HTTP 400 Bad Request.')
  })

  it('401: is an http error the caller can branch on', async () => {
    const { fetch } = mockFetch(() => new Response(null, { status: 401, statusText: 'Unauthorized' }))
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/me'))
    expect(error.kind).toBe('http')
    expect(error.status).toBe(401)
    expect(error.body).toBeUndefined()
  })

  it('500: keeps a non-JSON error body as (truncated) text', async () => {
    const page = `<html>${'x'.repeat(5_000)}</html>`
    const { fetch } = mockFetch(() => new Response(page, { status: 500, headers: { 'Content-Type': 'text/html' } }))
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/workouts'))
    expect(error.kind).toBe('http')
    expect(error.status).toBe(500)
    expect(error.isServerError).toBe(true)
    expect(typeof error.body).toBe('string')
    expect((error.body as string).length).toBeLessThanOrEqual(2_001)
  })

  it('never puts query values, headers or request bodies in the error message', async () => {
    const { fetch } = mockFetch(() => json({}, { status: 403 }))
    const error = await captureError(
      createApiClient({ baseUrl: BASE, fetch }).post('/notes', {
        query: { email: 'alex@example.com' },
        headers: { Authorization: 'Bearer secret-token' },
        body: { note: 'private' },
      }),
    )
    expect(error.path).toBe('/notes')
    for (const secret of ['alex@example.com', 'secret-token', 'private', 'api.test.local']) {
      expect(error.message).not.toContain(secret)
    }
  })
})

describe('apiClient – network, timeout and cancellation', () => {
  it('network failure: rejects with kind "network" and keeps the cause', async () => {
    const fetch = vi.fn<FetchFunction>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/workouts'))
    expect(error.kind).toBe('network')
    expect(error.status).toBeUndefined()
    expect(error.cause).toBeInstanceOf(TypeError)
  })

  it('timeout: aborts the request and reports kind "timeout"', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(hangingFetch)
    const pending = captureError(createApiClient({ baseUrl: BASE, fetch, timeoutMs: 5_000 }).get('/slow'))
    await vi.advanceTimersByTimeAsync(4_999)
    expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const error = await pending
    expect(error.kind).toBe('timeout')
    expect(error.message).toBe('GET /slow timed out after 5000 ms.')
    expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true)
  })

  it('timeout: a per-request value overrides the client default, and 0 disables it', async () => {
    vi.useFakeTimers()
    const client = createApiClient({ baseUrl: BASE, fetch: hangingFetch })
    const quick = captureError(client.get('/a', { timeoutMs: 100 }))
    await vi.advanceTimersByTimeAsync(100)
    expect((await quick).kind).toBe('timeout')

    const controller = new AbortController()
    const unlimited = captureError(client.get('/b', { timeoutMs: 0, signal: controller.signal }))
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS * 10)
    controller.abort()
    expect((await unlimited).kind).toBe('aborted') // still pending until cancelled: no timeout fired
  })

  it('timeout also covers a response body that never finishes', async () => {
    vi.useFakeTimers()
    const fetch: FetchFunction = async (_url, init) =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      }) as unknown as Response
    const pending = captureError(createApiClient({ baseUrl: BASE, fetch, timeoutMs: 1_000 }).get('/stream'))
    await vi.advanceTimersByTimeAsync(1_000)
    expect((await pending).kind).toBe('timeout')
  })

  it('cancellation: an external AbortSignal rejects with kind "aborted" (not "timeout")', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = captureError(
      createApiClient({ baseUrl: BASE, fetch: hangingFetch, timeoutMs: 5_000 }).get('/slow', {
        signal: controller.signal,
      }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    controller.abort()
    const error = await pending
    expect(error.kind).toBe('aborted')
    expect(error.message).toBe('GET /slow was cancelled.')
  })

  it('cancellation: an already-aborted signal never calls fetch', async () => {
    const { fetch } = mockFetch(() => json({}))
    const controller = new AbortController()
    controller.abort()
    const error = await captureError(createApiClient({ baseUrl: BASE, fetch }).get('/x', { signal: controller.signal }))
    expect(error.kind).toBe('aborted')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('clears its timer and abort listener after a successful request', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener')
    const { fetch } = mockFetch(() => json({ ok: true }))
    await createApiClient({ baseUrl: BASE, fetch }).get('/x', { signal: controller.signal })
    expect(vi.getTimerCount()).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function))
    controller.abort() // aborting later has no effect on a finished request
  })
})

describe('apiClient – configuration', () => {
  it('the shared client rejects with kind "config" when VITE_API_BASE_URL is missing, without calling fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const error = await captureError(apiClient.get('/workouts'))
      expect(error.kind).toBe('config')
      expect(error.message).toContain('VITE_API_BASE_URL is not set')
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })

  it('the shared client rejects an invalid VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'not a url')
    try {
      expect((await captureError(apiClient.get('/workouts'))).kind).toBe('config')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('the shared client uses a valid VITE_API_BASE_URL and the global fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/v1/')
    const fetchSpy = vi.fn(async () => json({ ok: true }))
    vi.stubGlobal('fetch', fetchSpy)
    try {
      await expect(apiClient.get('/health')).resolves.toEqual({ ok: true })
      expect(fetchSpy).toHaveBeenCalledWith('https://api.example.test/v1/health', expect.objectContaining({ method: 'GET' }))
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })
})

describe('feature service pattern (example, test-only)', () => {
  // How a future features/workouts/services/workout-service.ts would look.
  interface WorkoutSummary {
    id: string
    name: string
  }
  const parseWorkoutSummaries = (data: unknown): WorkoutSummary[] => {
    if (!Array.isArray(data)) throw new TypeError('Expected an array')
    return data.map((item: unknown) => {
      const candidate = item as Partial<WorkoutSummary>
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') throw new TypeError('Invalid workout')
      return { id: candidate.id, name: candidate.name }
    })
  }

  it('wraps the client in small typed functions that accept an AbortSignal', async () => {
    const { fetch, calls } = mockFetch(() => json([{ id: 'w1', name: 'Push Day', extra: 'ignored' }]))
    const client = createApiClient({ baseUrl: BASE, fetch })
    const workoutService = {
      list: (params: { from?: string }, signal?: AbortSignal) =>
        client.get('/workouts', { query: params, signal, parse: parseWorkoutSummaries }),
    }
    await expect(workoutService.list({ from: '2026-11-01' })).resolves.toEqual([{ id: 'w1', name: 'Push Day' }])
    expect(calls[0]!.url).toBe(`${BASE}/workouts?from=2026-11-01`)
  })
})
