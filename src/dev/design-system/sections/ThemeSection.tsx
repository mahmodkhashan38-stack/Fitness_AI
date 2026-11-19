import { Flame } from 'lucide-react'
import { Badge, Button, Card, ProgressBar, ThemeToggle } from '@/components/ui'
import { THEME_STORAGE_KEY } from '@/constants/theme'
import { Section } from '@/dev/design-system/Section'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/utils/cn'

function ThemePreview({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className={cn(theme, 'rounded-card bg-background p-4 text-foreground ring-1 ring-border')}>
      <p className="mb-3 text-overline text-foreground-muted uppercase">{theme} theme</p>
      <Card padding="sm" className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-foreground-muted">Daily Calories</span>
            <span className="numeric text-metric-sm">1,840 kcal</span>
          </div>
          <span className="flex size-9 items-center justify-center rounded-control bg-primary-subtle text-accent">
            <Flame className="size-4" aria-hidden="true" />
          </span>
        </div>
        <ProgressBar label={`Calories (${theme} preview)`} hideLabel value={71} showValue={false} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" tabIndex={-1}>
            Log meal
          </Button>
          <Badge variant="success">On track</Badge>
        </div>
      </Card>
    </div>
  )
}

export function ThemeSection() {
  const { preference, resolvedTheme } = useTheme()

  return (
    <Section
      id="theme"
      title="Theme"
      description="Light, Dark or System. The choice is saved in localStorage and applied by an inline script before first paint, so there is no flash on reload."
    >
      <Card className="gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-h4">Appearance</h3>
            <p className="text-body-sm text-foreground-muted" aria-live="polite">
              Preference: <strong className="font-semibold text-foreground capitalize">{preference}</strong> · Applied:{' '}
              <strong className="font-semibold text-foreground capitalize">{resolvedTheme}</strong>
            </p>
          </div>
          <ThemeToggle />
        </div>
        <p className="text-caption text-foreground-muted">
          Storage key: <code className="font-mono">{THEME_STORAGE_KEY}</code> · Hook:{' '}
          <code className="font-mono">useTheme()</code>
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2" aria-label="Theme previews">
        <ThemePreview theme="light" />
        <ThemePreview theme="dark" />
      </div>
    </Section>
  )
}
