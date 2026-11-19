import { Outlet, Link, ScrollRestoration } from 'react-router'
import BrandLogo from '@/components/layout/BrandLogo'
import RouteContentBoundary from '@/components/layout/RouteContentBoundary'
import { ThemeToggleButton } from '@/components/ui'
import { ROUTES } from '@/constants/routes'
import { useDocumentTitle, usePageTitle } from '@/hooks/usePageTitle'

/** Minimal layout for public pages (login, register): no app navigation. */
function PublicLayout() {
  const title = usePageTitle()
  useDocumentTitle(title)

  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex h-header w-full max-w-page items-center justify-between px-[max(1rem,env(safe-area-inset-left))] sm:px-6 lg:px-8">
        <Link to={ROUTES.dashboard} className="focus-ring rounded-control" aria-label="Fitness AI — go to Dashboard">
          <BrandLogo />
        </Link>
        <ThemeToggleButton />
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-12"
      >
        <div className="w-full max-w-md">
          <RouteContentBoundary>
            <Outlet />
          </RouteContentBoundary>
        </div>
      </main>

      <footer className="px-4 py-6 text-center text-caption text-foreground-muted">
        © {new Date().getFullYear()} Fitness AI
      </footer>
      <ScrollRestoration />
    </div>
  )
}

export default PublicLayout
