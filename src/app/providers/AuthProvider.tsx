import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SLOW_THRESHOLD_MS } from '@/constants/auth'
import { AuthContext, type AuthContextValue, type SessionUnavailability } from '@/hooks/useAuth'
import * as authApi from '@/services/api/auth'
import { isApiError } from '@/services/api/errors'
import * as fitnessProfileApi from '@/services/api/fitness-profile'
import type { AuthStatus, AuthUser } from '@/types/auth'


interface AuthState {
  status: AuthStatus
  /**
   * The last user the server confirmed. Kept while the session can't be verified
   * (`unavailable`) so nothing is lost, but only exposed while `authenticated`.
   */
  user: AuthUser | null
  unavailable?: SessionUnavailability
}

/**
 * Owns the session state. On start (and on refresh) it asks the server who is signed in
 * (GET /api/auth/me), so a session survives page reloads without storing anything in the
 * browser besides the HttpOnly cookie.
 *
 * When the session can't be verified (offline, Render cold start, outage, HTTP 429 or the
 * Worker's 503 UPSTREAM_UNAVAILABLE) the status is `unavailable`: neither signed in nor signed
 * out. Protected pages are not shown and no user is exposed (a failed check never grants
 * access), but the user isn't logged out or sent to the login page either. Checks are retried
 * with bounded exponential back-off, never before the server's Retry-After, and again when the
 * browser comes back online or the app returns to the foreground (also not before Retry-After).
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const [slow, setSlow] = useState(false)
  const [checkId, setCheckId] = useState(0)
  const attempts = useRef(0)
  /** Earliest time (ms) the server allows the next check (Retry-After); 0 when unconstrained. */
  const notBefore = useRef(0)
  const statusRef = useRef<AuthStatus>('loading')
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  const refresh = useCallback(() => setCheckId((id) => id + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS)
    let retryTimer: number | undefined

    authApi
      .fetchCurrentUser({ signal: controller.signal })
      .then((user) => {
        attempts.current = 0
        notBefore.current = 0
        setState(user ? { status: 'authenticated', user } : { status: 'unauthenticated', user: null })
      })
      .catch((error: unknown) => {
        if (isApiError(error) && error.kind === 'aborted') return
        if (authApi.isTemporaryAuthFailure(error)) {
          const retryAfter = isApiError(error) ? error.retryAfterSeconds : undefined
          const delay = authApi.sessionRetryDelayMs(attempts.current, retryAfter)
          attempts.current += 1
          // Only the server's Retry-After (bounded like the delay) blocks earlier retries.
          notBefore.current = retryAfter !== undefined && retryAfter > 0 ? Date.now() + Math.min(delay, retryAfter * 1000) : 0
          const reason = isApiError(error) && error.status === 429 ? 'rate-limited' : 'unreachable'
          const unavailable = { reason, notBefore: notBefore.current || null } as const
          setState((current) => ({ status: 'unavailable', user: current.user, unavailable }))
          retryTimer = window.setTimeout(refresh, delay)
          return
        }
        // Unexpected answer (e.g. malformed response): fail closed.
        setState({ status: 'unauthenticated', user: null })
      })
      .finally(() => {
        window.clearTimeout(slowTimer)
        if (!controller.signal.aborted) setSlow(false)
      })

    return () => {
      controller.abort()
      window.clearTimeout(slowTimer)
      window.clearTimeout(retryTimer)
    }
  }, [checkId, refresh])

  // Reconnect as soon as possible instead of waiting for the next back-off step.
  useEffect(() => {
    const retryIfUnavailable = () => {
      // The scheduled retry stays in place when the server asked us to wait (Retry-After).
      if (statusRef.current !== 'unavailable' || Date.now() < notBefore.current) return
      attempts.current = 0
      refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') retryIfUnavailable()
    }
    window.addEventListener('online', retryIfUnavailable)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', retryIfUnavailable)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const login = useCallback<AuthContextValue['login']>(async (credentials) => {
    const user = await authApi.login(credentials)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const register = useCallback<AuthContextValue['register']>(async (data) => {
    const user = await authApi.register(data)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const completeOnboarding = useCallback<AuthContextValue['completeOnboarding']>(async (profile) => {
    try {
      await fitnessProfileApi.completeOnboarding(profile)
    } catch (error) {
      // Completed meanwhile (another tab or device): the account already has its profile.
      if (authApi.apiErrorCode(error) !== 'ONBOARDING_ALREADY_COMPLETED') throw error
    }
    setState((current) =>
      current.status === 'authenticated' && current.user
        ? { status: 'authenticated', user: { ...current.user, onboardingCompleted: true } }
        : current,
    )
  }, [])

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    await authApi.logout()
    setState({ status: 'unauthenticated', user: null })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.status === 'authenticated' ? state.user : null,
      unavailable: state.status === 'unavailable' ? (state.unavailable ?? null) : null,
      slow,
      login,
      register,
      completeOnboarding,
      logout,
      refresh,
    }),
    [state, slow, login, register, completeOnboarding, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
