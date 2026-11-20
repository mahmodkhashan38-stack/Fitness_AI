import { ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { Avatar, Divider, Spinner, ThemeToggle } from '@/components/ui'
import { NAV_ITEMS, SIDEBAR_SECONDARY_NAV } from '@/constants/navigation'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'

/** Popover API: Chrome 114, Firefox 125, Safari 17. The default Vite build also targets older browsers. */
function supportsPopover(): boolean {
  return typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'
}

/**
 * Profile access in the header (on phones, the only way to Profile and Settings),
 * showing the signed-in user, with Log out.
 *
 * Uses the native Popover API where available: the button toggles it, Esc or an
 * outside click closes it, and focus returns to the button. Browsers without it
 * get the same behaviour from a small disclosure fallback (aria-expanded/controls).
 */
function AccountMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const displayName = user?.name ?? 'Account'
  const popoverId = useId()
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [native] = useState(supportsPopover)
  const [fallbackOpen, setFallbackOpen] = useState(false)

  const close = () => {
    if (native) popoverRef.current?.hidePopover()
    else setFallbackOpen(false)
  }

  const onLogout = async () => {
    setLogoutError(null)
    setLoggingOut(true)
    try {
      await logout()
      close()
      navigate(ROUTES.login, { replace: true })
    } catch {
      // The session is still valid on the server; don't pretend the user is logged out.
      setLogoutError('Couldn’t log out. Check your connection and try again.')
      setLoggingOut(false)
    }
  }

  // Fallback only: like a native popover, close on Escape (wherever focus is) or an outside click.
  useEffect(() => {
    if (native || !fallbackOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) setFallbackOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setFallbackOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [native, fallbackOpen])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        {...(native
          ? { popoverTarget: popoverId }
          : {
              'aria-expanded': fallbackOpen,
              'aria-controls': popoverId,
              onClick: () => setFallbackOpen((open) => !open),
            })}
        className="focus-ring flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-hover lg:pr-2"
      >
        <span className="sr-only">Account menu for {displayName}</span>
        <span aria-hidden="true" className="flex">
          <Avatar name={displayName} size="md" className="size-9" />
        </span>
        <ChevronDown className="hidden size-4 text-foreground-muted lg:block" aria-hidden="true" />
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        {...(native ? { popover: 'auto' as const } : { hidden: !fallbackOpen })}
        data-fallback-open={!native && fallbackOpen ? '' : undefined}
        className={cn(
          'fa-popover fixed inset-auto z-50 m-0 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-2 text-foreground shadow-elevated',
          'top-[calc(env(safe-area-inset-top)+var(--spacing-header-mobile)+0.25rem)] right-[max(1rem,env(safe-area-inset-right))]',
          'md:top-[calc(var(--spacing-header)+0.25rem)] md:right-6 lg:right-8',
        )}
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={displayName} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label text-foreground">{displayName}</span>
            {user && <span className="truncate text-caption text-foreground-muted">{user.email}</span>}
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
        <Divider className="my-1.5" />
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={loggingOut}
          aria-busy={loggingOut || undefined}
          className="focus-ring flex h-11 w-full cursor-pointer items-center gap-3 rounded-control px-2.5 text-label text-foreground transition-colors hover:bg-hover disabled:cursor-wait disabled:opacity-70"
        >
          {loggingOut ? (
            <Spinner size="sm" label={null} />
          ) : (
            <LogOut className="size-[1.125rem] text-foreground-muted" aria-hidden="true" />
          )}
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
        {logoutError && (
          <p role="alert" className="px-2.5 pt-1 pb-1.5 text-body-sm text-danger">
            {logoutError}
          </p>
        )}
        {/* Tablet/desktop have the theme switcher in the header; phones get it here. */}
        <div className="md:hidden">
          <Divider className="my-1.5" />
          <div className="flex flex-col gap-2 px-2 pt-1 pb-1.5">
            <span className="text-caption text-foreground-muted">Appearance</span>
            {/* Icon above label so all three options fit the menu down to 320px screens. */}
            <ThemeToggle className="w-full [&>div]:w-full [&_label]:h-auto [&_label]:min-w-0 [&_label]:flex-1 [&_label]:flex-col [&_label]:gap-1 [&_label]:px-1 [&_label]:py-2 [&_label]:text-caption" />
          </div>
        </div>
      </div>
    </>
  )
}

export default AccountMenu
