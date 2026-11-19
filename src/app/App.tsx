import { RouterProvider } from 'react-router'
import AppProviders from '@/app/providers/AppProviders'
import { router } from '@/app/router'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'
import ErrorFallback from '@/components/feedback/ErrorFallback'

/** Last line of defence: errors above the routes (providers, router setup). */
function AppCrashFallback({ error }: { error: unknown }) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-page px-4 sm:px-6">
      <ErrorFallback
        variant="page"
        title="Fitness AI couldn’t start"
        description="Something went wrong while loading the app. Reloading the page usually fixes it."
        error={error}
        retryLabel="Reload page"
        onRetry={() => window.location.reload()}
        focusOnMount
        headingLevel="h1"
      />
    </main>
  )
}

function App() {
  return (
    <ErrorBoundary fallback={({ error }) => <AppCrashFallback error={error} />}>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  )
}

export default App
