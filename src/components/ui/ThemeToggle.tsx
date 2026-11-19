import { Monitor, Moon, Sun } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'
import type { ThemePreference } from '@/types/theme'
import { cn } from '@/utils/cn'

const options: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
  { value: 'system', label: 'System', icon: <Monitor /> },
]

export interface ThemeToggleProps {
  /** Hide the text labels and show icons only (labels remain for screen readers). */
  iconOnly?: boolean
  className?: string
}

/**
 * Light / Dark / System selector built from native radio buttons:
 * Tab focuses the group, arrow keys change the theme.
 */
function ThemeToggle({ iconOnly = false, className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme()
  const name = useId()

  return (
    <fieldset className={cn('inline-flex', className)}>
      <legend className="sr-only">Theme</legend>
      <div className="inline-flex gap-1 rounded-control bg-surface-elevated p-1">
        {options.map((option) => {
          const checked = preference === option.value
          return (
            <label
              key={option.value}
              title={iconOnly ? option.label : undefined}
              className={cn(
                'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[calc(var(--radius-control)-4px)] text-label',
                'transition-[background-color,color,box-shadow] duration-150 ease-standard [&_svg]:size-4',
                'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
                iconOnly ? 'w-9' : 'px-3',
                checked ? 'bg-surface text-foreground shadow-card' : 'text-foreground-muted hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => setPreference(option.value)}
                className="sr-only"
              />
              <span className="flex" aria-hidden="true">
                {option.icon}
              </span>
              <span className={iconOnly ? 'sr-only' : undefined}>{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default ThemeToggle
