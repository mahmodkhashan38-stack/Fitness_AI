import { Link } from 'react-router'
import AccountMenu from '@/components/layout/AccountMenu'
import BrandLogo from '@/components/layout/BrandLogo'
import { ThemeToggle, ThemeToggleButton } from '@/components/ui'
import { ROUTES } from '@/constants/routes'

export interface AppHeaderProps {
  title: string
}

/**
 * Sticky top bar.
 * Mobile: brand mark + page title, one-tap theme switch, account menu.
 * md+: page title (the sidebar carries the brand), full theme switcher, account menu.
 */
function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-header-mobile max-w-page items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] md:h-header md:px-6 lg:px-8">
        <Link to={ROUTES.dashboard} className="focus-ring shrink-0 rounded-control md:hidden" aria-label="Fitness AI — go to Dashboard">
          <BrandLogo showWordmark={false} size="sm" />
        </Link>

        {/* Visual page title; the page's own <h1> stays the single top-level heading. */}
        <p className="min-w-0 flex-1 truncate text-h4 text-foreground md:text-h3" aria-live="polite">
          {title}
        </p>

        <div className="flex shrink-0 items-center gap-1 md:gap-3">
          {/* Visibility is set on wrappers so it can't clash with the components' own display classes. */}
          <span className="flex md:hidden">
            <ThemeToggleButton />
          </span>
          <span className="hidden md:flex">
            <ThemeToggle iconOnly />
          </span>
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

export default AppHeader
