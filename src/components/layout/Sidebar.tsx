import { Link } from 'react-router'
import BrandLogo from '@/components/layout/BrandLogo'
import NavigationItem from '@/components/layout/NavigationItem'
import { NAV_ITEMS, SIDEBAR_PRIMARY_NAV, SIDEBAR_SECONDARY_NAV } from '@/constants/navigation'
import { ROUTES } from '@/constants/routes'

/**
 * Persistent side navigation.
 * md (768–1023px): compact icon rail. lg+: full sidebar with labels.
 * Hidden below md, where the bottom navigation takes over.
 */
function Sidebar() {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-rail shrink-0 flex-col border-r border-border bg-surface md:flex lg:w-sidebar 2xl:w-sidebar-wide"
      aria-label="Sidebar"
    >
      <div className="flex h-header shrink-0 items-center justify-center px-3 lg:justify-start lg:px-5">
        <Link to={ROUTES.dashboard} className="focus-ring rounded-control" aria-label="Fitness AI — go to Dashboard">
          <span className="flex lg:hidden">
            <BrandLogo showWordmark={false} />
          </span>
          <span className="hidden lg:flex">
            <BrandLogo />
          </span>
        </Link>
      </div>

      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pt-4 lg:px-3">
        <ul className="flex flex-col gap-1">
          {SIDEBAR_PRIMARY_NAV.map((id) => (
            <li key={id}>
              <NavigationItem item={NAV_ITEMS[id]} variant="sidebar" />
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Account" className="shrink-0 border-t border-border px-1.5 py-4 lg:px-3">
        <p className="mb-2 hidden px-3 text-overline text-foreground-muted uppercase lg:block">Account</p>
        <ul className="flex flex-col gap-1">
          {SIDEBAR_SECONDARY_NAV.map((id) => (
            <li key={id}>
              <NavigationItem item={NAV_ITEMS[id]} variant="sidebar" />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
