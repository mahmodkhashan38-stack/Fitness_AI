import { House } from 'lucide-react'
import { useRouteError } from 'react-router'
import ErrorFallback from '@/components/feedback/ErrorFallback'
import { ROUTES } from '@/constants/routes'

/**
 * React Router `errorElement` for layout routes. Replaces the router's built-in
 * error screen (which shows stack traces) when a layout itself fails, and will
 * also receive loader/action errors once features use them.
 *
 * Uses a plain anchor for "Go to Dashboard" so it works even if routing state is broken,
 * and reloads the page for a real retry.
 */
function RouteErrorFallback() {
  const error = useRouteError()

  return (
    <main id="main-content" className="mx-auto w-full max-w-page px-4 sm:px-6">
      <ErrorFallback
        variant="page"
        title="Something went wrong"
        description="Fitness AI ran into an unexpected problem. Reloading the page usually fixes it."
        error={error}
        retryLabel="Reload page"
        onRetry={() => window.location.reload()}
        focusOnMount
        headingLevel="h1"
        secondaryAction={
          <a
            href={ROUTES.dashboard}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-control border border-border-strong px-4 text-body-sm font-semibold text-foreground transition-colors hover:bg-hover"
          >
            <House className="size-[1.125rem]" aria-hidden="true" />
            Go to Dashboard
          </a>
        }
      />
    </main>
  )
}

export default RouteErrorFallback
