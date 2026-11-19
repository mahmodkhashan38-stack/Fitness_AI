import { Moon, Sun } from 'lucide-react'
import IconButton, { type IconButtonProps } from '@/components/ui/IconButton'
import { useTheme } from '@/hooks/useTheme'

export type ThemeToggleButtonProps = Omit<IconButtonProps, 'label' | 'icon' | 'onClick'>

/** Compact one-tap light/dark switch for tight spaces such as the mobile header. */
function ThemeToggleButton(props: ThemeToggleButtonProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <IconButton
      label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      icon={isDark ? <Sun /> : <Moon />}
      onClick={toggleTheme}
      {...props}
    />
  )
}

export default ThemeToggleButton
