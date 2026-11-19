import { NavLink } from 'react-router'
import type { AppNavItem } from '@/types/navigation'
import { cn } from '@/utils/cn'
import { ROUTES } from '@/constants/routes'

export type NavigationItemVariant = 'sidebar' | 'bottom' | 'bottom-center'

export interface NavigationItemProps {
  item: AppNavItem
  variant: NavigationItemVariant
  onNavigate?: () => void
}

/**
 * One navigation link. NavLink sets aria-current="page" on the active route;
 * the active state is shown by shape and weight as well as colour.
 *
 * - `sidebar`: compact icon rail at md, full row with label at lg.
 * - `bottom`: mobile bottom-bar tab.
 * - `bottom-center`: the emphasised centre tab (Dashboard).
 */
function NavigationItem({ item, variant, onNavigate }: NavigationItemProps) {
  const Icon = item.icon
  const isRoot = item.path === ROUTES.dashboard
  const shortLabel = item.shortLabel ?? item.label

  if (variant === 'sidebar') {
    return (
      <NavLink
        to={item.path}
        end={isRoot}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'group focus-ring relative flex items-center rounded-control transition-colors duration-150 ease-standard',
            // Tablet rail: icon above a small label
            'flex-col gap-1 px-0.5 py-2 text-center text-[0.6875rem] leading-tight font-medium',
            // Desktop: full-width row
            'lg:h-11 lg:flex-row lg:gap-3 lg:px-3 lg:py-0 lg:text-left lg:text-label',
            isActive ? 'text-foreground lg:bg-surface-elevated' : 'text-foreground-muted hover:text-foreground lg:hover:bg-hover',
          )
        }
      >
        {({ isActive }) => (
          <>
            {/* Desktop active bar */}
            <span
              className={cn(
                'absolute top-2.5 bottom-2.5 left-0 hidden w-[3px] rounded-r-full bg-primary transition-opacity lg:block',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'flex h-8 w-14 shrink-0 items-center justify-center rounded-full transition-colors duration-150 lg:h-auto lg:w-auto lg:rounded-none',
                isActive ? 'bg-primary-subtle text-accent lg:bg-transparent' : 'group-hover:bg-hover lg:group-hover:bg-transparent',
              )}
              aria-hidden="true"
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.25 : 2} />
            </span>
            <span className={cn('max-w-full truncate', isActive && 'font-semibold')}>{item.label}</span>
          </>
        )}
      </NavLink>
    )
  }

  if (variant === 'bottom-center') {
    return (
      <NavLink
        to={item.path}
        end={isRoot}
        onClick={onNavigate}
        className="group focus-ring flex h-full flex-col items-center justify-start gap-1 rounded-control pt-1.5"
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                'flex size-12 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-200 ease-standard group-active:scale-95',
                '-mt-4 shadow-elevated ring-4 ring-surface',
                isActive
                  ? 'border-primary-edge bg-primary text-primary-foreground'
                  : 'border-border-strong bg-surface-elevated text-foreground group-hover:bg-border',
              )}
              aria-hidden="true"
            >
              <Icon className="size-[1.375rem]" strokeWidth={isActive ? 2.5 : 2} />
            </span>
            <span
              className={cn(
                'text-[0.6875rem] leading-tight',
                isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground-muted',
              )}
            >
              {shortLabel}
            </span>
          </>
        )}
      </NavLink>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={isRoot}
      onClick={onNavigate}
      className="group focus-ring flex h-full flex-col items-center justify-center gap-1 rounded-control"
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 ease-standard group-active:scale-95',
              isActive ? 'bg-primary-subtle text-accent' : 'text-foreground-muted group-hover:text-foreground',
            )}
            aria-hidden="true"
          >
            <Icon className="size-[1.375rem]" strokeWidth={isActive ? 2.25 : 2} />
          </span>
          <span
            className={cn(
              'text-[0.6875rem] leading-tight',
              isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground-muted',
            )}
          >
            {shortLabel}
          </span>
        </>
      )}
    </NavLink>
  )
}

export default NavigationItem
