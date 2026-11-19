import { ChevronDown } from 'lucide-react'
import { useId, useRef } from 'react'
import { NavLink } from 'react-router'
import { Avatar, Divider, ThemeToggle } from '@/components/ui'
import { NAV_ITEMS, PLACEHOLDER_PROFILE, SIDEBAR_SECONDARY_NAV } from '@/constants/navigation'
import { cn } from '@/utils/cn'

/**
 * Profile access in the header. Uses the native Popover API:
 * the button toggles it, Esc or an outside click closes it,
 * and focus returns to the button. Placeholder profile data only.
 */
function AccountMenu() {
  const popoverId = useId()
  const popoverRef = useRef<HTMLDivElement>(null)
  const close = () => popoverRef.current?.hidePopover()

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        className="focus-ring flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-hover lg:pr-2"
      >
        <span className="sr-only">Account menu for {PLACEHOLDER_PROFILE.name}</span>
        <span aria-hidden="true" className="flex">
          <Avatar name={PLACEHOLDER_PROFILE.name} size="md" className="size-9" />
        </span>
        <ChevronDown className="hidden size-4 text-foreground-muted lg:block" aria-hidden="true" />
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        aria-label="Account"
        className={cn(
          'fa-popover fixed inset-auto m-0 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-2 text-foreground shadow-elevated',
          'top-[calc(env(safe-area-inset-top)+var(--spacing-header-mobile)+0.25rem)] right-[max(1rem,env(safe-area-inset-right))]',
          'md:top-[calc(var(--spacing-header)+0.25rem)] md:right-6 lg:right-8',
        )}
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={PLACEHOLDER_PROFILE.name} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label text-foreground">{PLACEHOLDER_PROFILE.name}</span>
            <span className="truncate text-caption text-foreground-muted">{PLACEHOLDER_PROFILE.detail}</span>
          </div>
        </div>
        <Divider className="my-1.5" />
        <ul className="flex flex-col gap-0.5">
          {SIDEBAR_SECONDARY_NAV.map((id) => {
            const item = NAV_ITEMS[id]
            const Icon = item.icon
            return (
              <li key={id}>
                <NavLink
                  to={item.path}
                  onClick={close}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring flex h-11 items-center gap-3 rounded-control px-2.5 text-label transition-colors',
                      isActive ? 'bg-surface-elevated font-semibold text-foreground' : 'text-foreground hover:bg-hover',
                    )
                  }
                >
                  <Icon className="size-[1.125rem] text-foreground-muted" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
        {/* Tablet/desktop have the theme switcher in the header; phones get it here. */}
        <div className="md:hidden">
          <Divider className="my-1.5" />
          <div className="flex flex-col gap-2 px-2 pt-1 pb-1.5">
            <span className="text-caption text-foreground-muted">Appearance</span>
            <ThemeToggle className="w-full [&>div]:w-full [&_label]:flex-1" />
          </div>
        </div>
      </div>
    </>
  )
}

export default AccountMenu
