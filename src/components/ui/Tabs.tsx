import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/utils/cn'

type TabsVariant = 'segmented' | 'underline'

interface TabsContextValue {
  baseId: string
  value: string
  variant: TabsVariant
  select: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) throw new Error(`<${component}> must be used inside <Tabs>.`)
  return context
}

const toIdPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-')

export interface TabsProps {
  /** Controlled selected value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  onValueChange?: (value: string) => void
  variant?: TabsVariant
  children: ReactNode
  className?: string
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern): arrow keys move between tabs,
 * Home/End jump to the first/last tab, and the focused tab is activated.
 */
export function Tabs({
  value,
  defaultValue = '',
  onValueChange,
  variant = 'segmented',
  children,
  className,
}: TabsProps) {
  const baseId = useId()
  const [internalValue, setInternalValue] = useState(defaultValue)
  const current = value ?? internalValue

  const select = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ baseId, value: current, variant, select }}>
      <div className={cn('flex flex-col gap-4', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps {
  /** Describes the tab set for screen readers, e.g. "Progress period". */
  'aria-label': string
  children: ReactNode
  fullWidth?: boolean
  className?: string
}

export function TabsList({ children, fullWidth, className, ...props }: TabsListProps) {
  const { variant } = useTabsContext('TabsList')

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    )
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement)
    if (currentIndex === -1) return

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = tabs[nextIndex]
    nextTab?.focus()
    nextTab?.click()
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'flex max-w-full overflow-x-auto',
        variant === 'segmented'
          ? 'gap-1 rounded-control bg-surface-elevated p-1'
          : 'gap-6 border-b border-border',
        fullWidth ? 'w-full' : 'w-fit',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
  className?: string
}

export function TabsTrigger({ value, children, icon, disabled, className }: TabsTriggerProps) {
  const context = useTabsContext('TabsTrigger')
  const selected = context.value === value
  const id = `${context.baseId}-tab-${toIdPart(value)}`
  const panelId = `${context.baseId}-panel-${toIdPart(value)}`

  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => context.select(value)}
      className={cn(
        'focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 text-label whitespace-nowrap',
        'transition-[background-color,color,box-shadow,border-color] duration-150 ease-standard',
        'disabled:cursor-not-allowed disabled:text-disabled-foreground [&_svg]:size-4',
        context.variant === 'segmented'
          ? cn(
              'h-9 flex-1 rounded-[calc(var(--radius-control)-4px)] px-3.5',
              selected
                ? 'bg-surface text-foreground shadow-card'
                : 'text-foreground-muted hover:text-foreground',
            )
          : cn(
              '-mb-px h-11 border-b-2 px-0.5',
              selected
                ? 'border-accent text-foreground'
                : 'border-transparent text-foreground-muted hover:text-foreground',
            ),
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = useTabsContext('TabsContent')
  const selected = context.value === value

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-panel-${toIdPart(value)}`}
      aria-labelledby={`${context.baseId}-tab-${toIdPart(value)}`}
      hidden={!selected}
      tabIndex={0}
      className={cn('rounded-card', className)}
    >
      {selected && children}
    </div>
  )
}
