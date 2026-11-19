import NavigationItem from '@/components/layout/NavigationItem'
import { MOBILE_NAV, MOBILE_NAV_CENTER, NAV_ITEMS } from '@/constants/navigation'

/**
 * Fixed mobile tab bar (below md). Five equal columns keep Dashboard exactly centred.
 * Bottom padding respects the device safe area (home indicator).
 */
function BottomNavigation() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-bottom-nav max-w-lg grid-cols-5 px-[max(0.5rem,env(safe-area-inset-left))]">
        {MOBILE_NAV.map((id) => (
          <li key={id} className="min-w-0">
            <NavigationItem item={NAV_ITEMS[id]} variant={id === MOBILE_NAV_CENTER ? 'bottom-center' : 'bottom'} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNavigation
