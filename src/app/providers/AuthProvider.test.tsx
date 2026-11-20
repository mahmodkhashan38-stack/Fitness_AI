import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '@/app/providers/AuthProvider'
import { RETRY_DELAYS_MS, SLOW_THRESHOLD_MS } from '@/constants/auth'
import { useAuth, type AuthContextValue } from '@/hooks/useAuth'

const user = { id: 'u1', email: 'alex@example.com', name: 'Alex', createdAt: '2026-11-20T10:00:00.000Z' }
const ok = () => Response.json({ user })
const unauthenticated = () => Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 })
const unavailable = () => Response.json({ error: { code: 'SERVICE_UNAVAILABLE' } }, { status: 503 })

/** Latest context value, captured after each render (not during it). */
const latest: { current?: AuthContextValue } = {}
function Probe() {
  const value = useAuth()
  useEffect(() => {
    latest.current = value
  })
  return <p data-testid="status">{`${value.status}:${value.user?.email ?? '-'}:${value.slow ? 'slow' : 'fast'}`}</p>
}
const auth = new Proxy({} as AuthContextValue, { get: (_target, key: keyof AuthContextValue) => latest.current![key] })
const status = () => screen.getByTestId('status').textContent
const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const settle = () => act(async () => {})

describe('AuthProvider', () => {
  it('starts in loading and resolves to the signed-in user (session restored after a page reload)', async () => {
    fetchMock.mockImplementation(async () => ok())
    renderProvider()
    expect(status()).toBe('loading:-:fast')
    await settle()
    expect(status()).toBe('authenticated:alex@example.com:fast')
  })

  it('is unauthenticated when the server has no session for this browser', async () => {
    fetchMock.mockImplementation(async () => unauthenticated())
    renderProvider()
    await settle()
    expect(status()).toBe('unauthenticated:-:fast')
  })

  it('a fresh mount (page refresh) asks the server again instead of trusting local state', async () => {
    fetchMock.mockImplementation(async () => ok())
    const first = renderProvider()
    await settle()
    first.unmount()
    fetchMock.mockImplementation(async () => unauthenticated()) // e.g. logged out on another device
    renderProvider()
    await settle()
    expect(status()).toBe('unauthenticated:-:fast')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('treats server outages as unavailable (not logged out) and retries with back-off', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(unavailable()).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(async () => ok())
    renderProvider()
    await settle()
    expect(status()).toBe('unavailable:-:fast')

    await act(async () => vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]))
    expect(status()).toBe('unavailable:-:fast')
    await act(async () => vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]))
    expect(status()).toBe('authenticated:alex@example.com:fast')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('reconnects immediately when the browser comes back online (installed PWA opened offline)', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(async () => ok())
    renderProvider()
    await settle()
    expect(status()).toBe('unavailable:-:fast')
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(status()).toBe('authenticated:alex@example.com:fast')
  })

  it('shows the cold-start hint while a check is slow', async () => {
    vi.useFakeTimers()
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    renderProvider()
    await act(async () => vi.advanceTimersByTimeAsync(SLOW_THRESHOLD_MS))
    expect(status()).toBe('loading:-:slow')
    await act(async () => resolve(ok()))
    expect(status()).toBe('authenticated:alex@example.com:fast')
  })

  it('fails closed on a malformed response', async () => {
    fetchMock.mockImplementation(async () => Response.json({ user: { id: 1 } }))
    renderProvider()
    await settle()
    expect(status()).toBe('unauthenticated:-:fast')
  })

  it('login, register and logout update the state', async () => {
    fetchMock.mockResolvedValueOnce(unauthenticated())
    renderProvider()
    await settle()

    fetchMock.mockResolvedValueOnce(ok())
    await act(async () => void (await auth.login({ email: 'alex@example.com', password: 'pw pw pw pw pw' })))
    expect(status()).toBe('authenticated:alex@example.com:fast')

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await act(async () => auth.logout())
    expect(status()).toBe('unauthenticated:-:fast')

    fetchMock.mockResolvedValueOnce(Response.json({ user }, { status: 201 }))
    await act(async () => void (await auth.register({ email: 'alex@example.com', password: 'pw pw pw pw pw', name: 'Alex' })))
    expect(status()).toBe('authenticated:alex@example.com:fast')
  })

  it('keeps the user signed in when logout fails (the server session still exists)', async () => {
    fetchMock.mockResolvedValueOnce(ok())
    renderProvider()
    await settle()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => {
      await expect(auth.logout()).rejects.toMatchObject({ kind: 'network' })
    })
    expect(status()).toBe('authenticated:alex@example.com:fast')
  })

  it('never writes tokens or user data to web storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    fetchMock.mockImplementation(async () => ok())
    renderProvider()
    await settle()
    await act(async () => void (await auth.login({ email: 'alex@example.com', password: 'pw pw pw pw pw' })))
    expect(setItem).not.toHaveBeenCalled()
    expect(document.cookie).toBe('') // the session cookie is HttpOnly: never visible to scripts
  })
})
