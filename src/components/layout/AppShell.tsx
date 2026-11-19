import { Outlet, ScrollRestoration } from 'react-router'
import AppHeader from '@/components/layout/AppHeader'
import BottomNavigation from '@/components/layout/BottomNavigation'
import RouteContentBoundary from '@/components/layout/RouteContentBoundary'
import Sidebar from '@/components/layout/Sidebar'
import { useDocumentTitle, usePageTitle } from '@/hooks/usePageTitle'

/**
 * Layout for all signed-in app screens.
 * < 768px: header + fixed bottom navigation.
 * 768–1023px: icon rail + header.  ≥ 1024px: full sidebar + header.
 */
function AppShell() {
  const title = usePageTitle()
  useDocumentTitle(title)

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="focus-ring sr-only z-50 rounded-control bg-primary px-4 py-2 text-label text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={title} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-page flex-1 px-[max(1rem,env(safe-area-inset-left))] pt-6 pb-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom)+2rem)] outline-none sm:px-6 md:px-6 md:pt-8 md:pb-12 lg:px-8"
        >
          <RouteContentBoundary>
            <Outlet />
          </RouteContentBoundary>
        </main>
      </div>

      <BottomNavigation />
      <ScrollRestoration />
    </div>
  )
}

export default AppShell
