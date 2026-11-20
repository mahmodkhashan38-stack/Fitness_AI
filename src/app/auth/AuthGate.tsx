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

/** Shown instead of protected pages while the session can't be verified. Retries automatically. */
function SessionUnavailable() {
  const { refresh, slow } = useAuth()
  const online = useOnlineStatus()
  return (
    <main id="main-content" className="mx-auto w-full max-w-page px-4 sm:px-6">
      <ErrorFallback
        variant="page"
        title={online ? 'Can’t reach Fitness AI' : 'You’re offline'}
        description={
          online
            ? 'The server may be starting up, which can take up to a minute. We’ll keep trying automatically.'
            : 'Fitness AI needs a connection to check your account. We’ll reconnect automatically when you’re back online.'
        }
        retryLabel={slow ? 'Retrying…' : 'Try again'}
        onRetry={refresh}
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
    const target = `${location.pathname}${location.search}${location.hash}`
    const query = target === ROUTES.dashboard ? '' : `?redirect=${encodeURIComponent(target)}`
    return <Navigate to={`${ROUTES.login}${query}`} replace />
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
