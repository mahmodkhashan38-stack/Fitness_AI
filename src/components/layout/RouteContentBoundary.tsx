import { House } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'
import ErrorFallback from '@/components/feedback/ErrorFallback'
import { ROUTES } from '@/constants/routes'

/**
 * Isolates the routed page content. If a page crashes while rendering, the fallback
 * replaces only the page, so navigation and header keep working. Navigating to
 * another path clears the error automatically.
 */
function RouteContentBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  return (
    <ErrorBoundary
      resetKeys={[pathname]}
      fallback={({ error, reset }) => (
        <ErrorFallback
          title="This page couldn’t be displayed"
          description="Something went wrong while showing this page. Try again, or go back to your Dashboard."
          error={error}
          onRetry={reset}
          focusOnMount
          headingLevel="h1"
          secondaryAction={
            pathname === ROUTES.dashboard ? undefined : (
              <Link
                to={ROUTES.dashboard}
                className="focus-ring inline-flex h-11 items-center gap-2 rounded-control border border-border-strong px-4 text-body-sm font-semibold text-foreground transition-colors hover:bg-hover"
              >
                <House className="size-[1.125rem]" aria-hidden="true" />
                Go to Dashboard
              </Link>
            )
          }
        />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

export default RouteContentBoundary
