import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RETRY_DELAYS_MS, SLOW_THRESHOLD_MS } from '@/constants/auth'
import { AuthContext, type AuthContextValue } from '@/hooks/useAuth'
import * as authApi from '@/services/api/auth'
import { isApiError } from '@/services/api/errors'
import * as fitnessProfileApi from '@/services/api/fitness-profile'
import type { AuthStatus, AuthUser } from '@/types/auth'


interface AuthState {
  status: AuthStatus
  user: AuthUser | null
}

/**
 * Owns the session state. On start (and on refresh) it asks the server who is signed in
 * (GET /api/auth/me), so a session survives page reloads without storing anything in the
 * browser besides the HttpOnly cookie.
 *
 * When the server can't be reached (offline, Render cold start, outage) the status is
 * `unavailable`, not `unauthenticated`: the user isn't sent to the login page just because
 * the network failed. Checks are retried with back-off, immediately when the browser comes
 * back online, and when the app returns to the foreground.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const [slow, setSlow] = useState(false)
  const [checkId, setCheckId] = useState(0)
  const attempts = useRef(0)
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
        setState(user ? { status: 'authenticated', user } : { status: 'unauthenticated', user: null })
      })
      .catch((error: unknown) => {
        if (isApiError(error) && error.kind === 'aborted') return
        if (authApi.isTemporaryAuthFailure(error)) {
          setState((current) => ({ status: 'unavailable', user: current.user }))
          const delay = RETRY_DELAYS_MS[Math.min(attempts.current, RETRY_DELAYS_MS.length - 1)]
          attempts.current += 1
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
      if (statusRef.current !== 'unavailable') return
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

  const updateName = useCallback<AuthContextValue['updateName']>(async (name) => {
    const user = await authApi.updateName(name)
    setState((current) => (current.status === 'authenticated' ? { status: 'authenticated', user } : current))
    return user
  }, [])

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    await authApi.logout()
    setState({ status: 'unauthenticated', user: null })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.status === 'authenticated' ? state.user : null,
      slow,
      login,
      register,
      completeOnboarding,
      updateName,
      logout,
      refresh,
    }),
    [state, slow, login, register, completeOnboarding, updateName, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
