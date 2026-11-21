import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCurrentUser,
  isTemporaryAuthFailure,
  login,
  logout,
  parseAuthUser,
  register,
  sessionRetryDelayMs,
  toAuthFormError,
  updateName,
} from '@/services/api/auth'
import { ApiError } from '@/services/api/errors'
import { TEST_PROFILE_INPUT } from '@/test/fitness-profile'

const user = { id: 'u1', email: 'alex@example.com', name: 'Alex', createdAt: '2026-11-20T10:00:00.000Z', onboardingCompleted: true }
const json = (body: unknown, status = 200) => Response.json(body, { status })
const httpError = (status: number, body: unknown) => new ApiError({ kind: 'http', status, body, message: 'x' })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('auth API', () => {
  it('fetchCurrentUser returns the user, or null for 401 (no session)', async () => {
    fetchMock.mockResolvedValueOnce(json({ user }))
    expect(await fetchCurrentUser()).toEqual(user)
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/me')

    fetchMock.mockResolvedValueOnce(json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401))
    expect(await fetchCurrentUser()).toBeNull()
  })

  it('fetchCurrentUser throws for server errors (not treated as logged out)', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503))
    await expect(fetchCurrentUser()).rejects.toMatchObject({ kind: 'http', status: 503 })
  })

  it('login and register POST JSON same-origin, letting the browser handle the cookie', async () => {
    fetchMock.mockImplementation(async () => json({ user }))
    await login({ email: 'alex@example.com', password: 'pw pw pw pw pw' })
    await register({ email: 'alex@example.com', password: 'pw pw pw pw pw', name: 'Alex', profile: TEST_PROFILE_INPUT })
    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(loginUrl).toBe('/api/auth/login')
    expect(loginInit.method).toBe('POST')
    expect(new Headers(loginInit.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(loginInit.body as string)).toEqual({ email: 'alex@example.com', password: 'pw pw pw pw pw' })
    // Default credentials ("same-origin"): no tokens in headers, nothing stored by the app.
    expect(loginInit.credentials).toBeUndefined()
    expect(new Headers(loginInit.headers).get('authorization')).toBeNull()
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('/api/auth/register')
  })

  it('logout POSTs to /auth/logout and accepts 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(logout()).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/logout')
  })

  it('rejects malformed user payloads', () => {
    expect(() => parseAuthUser({ ...user, id: 1 })).toThrow()
    expect(() => parseAuthUser(null)).toThrow()
    // The onboarding state is required (FIT-12): a missing or non-boolean flag fails closed.
    expect(() => parseAuthUser({ ...user, onboardingCompleted: undefined })).toThrow()
    expect(() => parseAuthUser({ ...user, onboardingCompleted: 'true' })).toThrow()
    expect(parseAuthUser({ ...user, passwordHash: 'x' })).toEqual(user) // extra fields dropped
  })
})

describe('isTemporaryAuthFailure', () => {
  it.each([
    [new ApiError({ kind: 'network', message: 'x' }), true],
    [new ApiError({ kind: 'timeout', message: 'x' }), true],
    [httpError(502, null), true],
    [httpError(503, null), true],
    [httpError(401, null), false],
    [httpError(400, null), false],
    [new ApiError({ kind: 'parse', message: 'x' }), false],
    [new Error('x'), false],
  ])('%#', (error, expected) => {
    expect(isTemporaryAuthFailure(error)).toBe(expected)
  })
})

describe('toAuthFormError', () => {
  it('uses server field messages for validation errors', () => {
    expect(toAuthFormError(httpError(400, { error: { code: 'VALIDATION_FAILED', fields: { email: 'Enter a valid email address.', role: 'x' } } }))).toEqual({
      message: null,
      fields: { email: 'Enter a valid email address.' },
    })
  })

  it('maps known codes to fixed copy', () => {
    expect(toAuthFormError(httpError(401, { error: { code: 'INVALID_CREDENTIALS', message: 'server text' } }))!.message).toBe(
      'Email or password is incorrect.',
    )
    expect(toAuthFormError(httpError(409, { error: { code: 'EMAIL_TAKEN' } }))!.fields.email).toMatch(/already exists/)
    expect(toAuthFormError(httpError(429, { error: { code: 'RATE_LIMITED' } }))!.message).toMatch(/Too many attempts/)
    expect(toAuthFormError(httpError(403, { error: { code: 'CSRF_REJECTED' } }))!.message).toMatch(/Reload the page/)
    expect(toAuthFormError(httpError(503, { error: { code: 'SERVICE_UNAVAILABLE' } }))!.message).toMatch(/starting up/)
    expect(toAuthFormError(httpError(502, 'html error page'))!.message).toMatch(/starting up/)
  })

  it('never shows unknown server messages', () => {
    const mapped = toAuthFormError(httpError(418, { error: { code: 'TEAPOT', message: 'stack trace at db.js:12' } }))!
    expect(mapped.message).toBe('Something went wrong. Please try again.')
  })

  it('handles network, timeout and cancellation', () => {
    expect(toAuthFormError(new ApiError({ kind: 'network', message: 'x' }))!.message).toMatch(/Can’t reach Fitness AI/)
    expect(toAuthFormError(new ApiError({ kind: 'timeout', message: 'x' }))!.message).toMatch(/taking too long/)
    expect(toAuthFormError(new ApiError({ kind: 'aborted', message: 'x' }))).toBeNull()
    expect(toAuthFormError(new Error('boom'))!.message).toBe('Something went wrong. Please try again.')
  })
})

describe('updateName', () => {
  it('PATCHes /users/me with only the name and returns the updated user', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api')
    const fetchMock = vi.fn(async () => Response.json({ user: { ...user, name: 'Alex Rivera' } }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const updated = await updateName('Alex Rivera')
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect([url, init.method, JSON.parse(init.body as string)]).toEqual(['/api/users/me', 'PATCH', { name: 'Alex Rivera' }])
      expect(updated.name).toBe('Alex Rivera')
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })
})

describe('rate limiting and upstream failures (FIT-11 hotfix)', () => {
  const http = (status: number, body: unknown, retryAfterSeconds?: number) =>
    new ApiError({ kind: 'http', status, body, retryAfterSeconds, message: 'x' })

  it('a 429 or 5xx on the session check is temporary (not a sign-out); 401 and malformed answers are not', () => {
    expect(isTemporaryAuthFailure(http(429, { error: { code: 'RATE_LIMITED' } }))).toBe(true)
    expect(isTemporaryAuthFailure(http(429, '<html>Just a moment...</html>'))).toBe(true)
    expect(isTemporaryAuthFailure(http(503, { error: { code: 'UPSTREAM_UNAVAILABLE' } }))).toBe(true)
    expect(isTemporaryAuthFailure(http(401, { error: { code: 'UNAUTHENTICATED' } }))).toBe(false)
    expect(isTemporaryAuthFailure(http(403, { error: { code: 'FORBIDDEN' } }))).toBe(false)
    expect(isTemporaryAuthFailure(new ApiError({ kind: 'parse', message: 'x' }))).toBe(false)
  })

  it('backs off exponentially within bounds and never retries before Retry-After', () => {
    expect([0, 1, 2, 3, 4, 5, 50].map((attempt) => sessionRetryDelayMs(attempt))).toEqual([2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000])
    expect(sessionRetryDelayMs(0, 42)).toBe(42_000)
    expect(sessionRetryDelayMs(4, 5)).toBe(30_000)
    expect(sessionRetryDelayMs(0, 86_400)).toBe(5 * 60_000)
    expect(sessionRetryDelayMs(-3)).toBe(2_000)
  })

  it.each([
    [http(429, { error: { code: 'RATE_LIMITED' } }, 600), 'Too many attempts. Please try again in about 10 minutes.'],
    [http(429, { error: { code: 'RATE_LIMITED' } }, 75), 'Too many attempts. Please try again in about a minute.'],
    [http(429, { error: { code: 'RATE_LIMITED' } }, 20), 'Too many attempts. Please try again in about 20 seconds.'],
    [http(429, { error: { code: 'RATE_LIMITED' } }), 'Too many attempts. Please wait a few minutes and try again.'],
    [http(429, '<html>Just a moment...</html>'), 'Fitness AI is receiving too many requests right now. Please wait a moment and try again.'],
    [http(503, { error: { code: 'UPSTREAM_UNAVAILABLE' } }, 30), 'Fitness AI is temporarily unavailable. Please try again in a moment.'],
    [http(502, '<html>Bad gateway</html>'), 'Fitness AI is starting up or temporarily unavailable. Please try again in a moment.'],
  ])('login and registration explain %#', (error, message) => {
    expect(toAuthFormError(error)).toEqual({ message, fields: {} })
  })
})
