import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import ErrorFallback from '@/components/feedback/ErrorFallback'
import LoadingState from '@/components/feedback/LoadingState'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { safeRedirectPath } from '@/utils/safe-redirect'

const SLOW_MESSAGE = 'Waking up Fitness AI… This can take up to a minute.'

function SessionCheck() {
  const { slow } = useAuth()
  return (
    <main id="main-content" className="mx-auto w-full max-w-page px-4 sm:px-6" aria-busy="true">
      <LoadingState variant="page" label={slow ? SLOW_MESSAGE : 'Checking your session…'} />
    </main>
  )
}

/** True once `at` (epoch ms) has passed; re-renders at that moment. */
function useTimeReached(at: number | undefined): boolean {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (at === undefined || at <= Date.now()) return
    const timer = window.setTimeout(() => setNow(Date.now()), at - Date.now() + 50)
    return () => window.clearTimeout(timer)
  }, [at])
  return at === undefined || now >= at
}

/**
 * Shown instead of protected pages while the session can't be verified (status
 * `unavailable`). It shows no account data: a failed check never grants access. The user is
 * not logged out either; checks continue automatically. "Try again" is offered only once the
 * server's requested wait (Retry-After) has passed.
 */
function SessionUnavailable() {
  const { refresh, slow, unavailable } = useAuth()
  const online = useOnlineStatus()
  const canRetry = useTimeReached(unavailable?.notBefore ?? undefined)
  const rateLimited = unavailable?.reason === 'rate-limited'

  let title = 'Can’t reach Fitness AI'
  let description = 'The server may be starting up, which can take up to a minute. We’ll keep trying automatically.'
  if (!online) {
    title = 'You’re offline'
    description = 'Fitness AI needs a connection to check your account. We’ll reconnect automatically when you’re back online.'
  } else if (rateLimited) {
    title = 'Fitness AI is busy'
    description = 'Too many requests reached Fitness AI, so we couldn’t confirm your session yet. You haven’t been logged out; we’ll try again automatically.'
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-page px-4 sm:px-6">
      <ErrorFallback
        variant="page"
        title={title}
        description={canRetry ? description : `${description} Next check in a moment.`}
        retryLabel={slow ? 'Retrying…' : 'Try again'}
        onRetry={canRetry ? refresh : undefined}
        focusOnMount
        headingLevel="h1"
      />
    </main>
  )
}

/**
 * Layout route for signed-in pages. Unauthenticated visitors go to the login page and come
 * back afterwards (?redirect=). This is a UX guard only: every protected API endpoint checks
 * the session itself, so data is never protected by the frontend alone.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SessionCheck />
  if (status === 'unavailable') return <SessionUnavailable />
  if (status === 'unauthenticated') {
    return <Navigate to={`${ROUTES.login}${redirectQuery(`${location.pathname}${location.search}${location.hash}`)}`} replace />
  }
  return <Outlet />
}

/** The current location as a ?redirect= value (omitted for the dashboard, the default target). */
function redirectQuery(target: string): string {
  return target === ROUTES.dashboard ? '' : `?redirect=${encodeURIComponent(target)}`
}

/**
 * Layout route inside RequireAuth for every fitness feature (the whole app shell): accounts
 * created before FIT-12 complete their fitness profile first. /onboarding is outside this gate
 * and OnboardingOnly sends completed users away from it, so the two can never loop.
 * UX only: the API enforces ownership and onboarding state itself.
 */
export function RequireOnboarding() {
  const { user } = useAuth()
  const location = useLocation()
  if (user && !user.onboardingCompleted) {
    return <Navigate to={`${ROUTES.onboarding}${redirectQuery(`${location.pathname}${location.search}${location.hash}`)}`} replace />
  }
  return <Outlet />
}

/** Layout route for /onboarding (inside RequireAuth): once onboarding is complete, continue to the app. */
export function OnboardingOnly() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  if (user?.onboardingCompleted) {
    return <Navigate to={safeRedirectPath(searchParams.get('redirect')) ?? ROUTES.dashboard} replace />
  }
  return <Outlet />
}

/** Layout route for the login and registration pages: signed-in users go straight to the app. */
export function GuestOnly() {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()

  if (status === 'loading') return <LoadingState variant="page" label="Checking your session…" />
  if (status === 'authenticated') {
    return <Navigate to={safeRedirectPath(searchParams.get('redirect')) ?? ROUTES.dashboard} replace />
  }
  return <Outlet />
}
