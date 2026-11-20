import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCurrentUser,
  isTemporaryAuthFailure,
  login,
  logout,
  parseAuthUser,
  register,
  toAuthFormError,
} from '@/services/api/auth'
import { ApiError } from '@/services/api/errors'

const user = { id: 'u1', email: 'alex@example.com', name: 'Alex', createdAt: '2026-11-20T10:00:00.000Z' }
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
    await register({ email: 'alex@example.com', password: 'pw pw pw pw pw', name: 'Alex' })
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
