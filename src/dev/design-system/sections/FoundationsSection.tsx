import { Card } from '@/components/ui'
import { DemoGroup, Section } from '@/dev/design-system/Section'
import { cn } from '@/utils/cn'

interface TokenSwatch {
  name: string
  className: string
  light: string
  dark: string
  bordered?: boolean
}

const surfaceTokens: TokenSwatch[] = [
  { name: 'background', className: 'bg-background', light: '#F6F8F4', dark: '#0B0F0E', bordered: true },
  { name: 'surface', className: 'bg-surface', light: '#FFFFFF', dark: '#171D1A', bordered: true },
  { name: 'surface-elevated', className: 'bg-surface-elevated', light: '#EDF1EA', dark: '#202923' },
  { name: 'surface-muted', className: 'bg-surface-muted', light: '#F0F3ED', dark: '#1C231F' },
  { name: 'foreground', className: 'bg-foreground', light: '#18221A', dark: '#F5F7F4' },
  { name: 'foreground-muted', className: 'bg-foreground-muted', light: '#5E6D62', dark: '#A0ADA3' },
  { name: 'border', className: 'bg-border', light: '#DCE3D8', dark: '#263029' },
  { name: 'input', className: 'bg-input', light: '#7C897F', dark: '#687869' },
  { name: 'accent', className: 'bg-accent', light: '#3F6A0A', dark: '#B5ED59' },
  { name: 'ring', className: 'bg-ring', light: '#4C7D0E', dark: '#B5ED59' },
  { name: 'disabled', className: 'bg-disabled', light: '#E6EBE3', dark: '#1F2622' },
  { name: 'hover', className: 'bg-hover', light: 'fg / 5%', dark: 'fg / 6%', bordered: true },
]

const statusTokens = [
  { name: 'Success', text: 'text-success', bg: 'bg-success-subtle', sample: 'Workout completed' },
  { name: 'Warning', text: 'text-warning', bg: 'bg-warning-subtle', sample: 'Low protein today' },
  { name: 'Danger', text: 'text-danger', bg: 'bg-danger-subtle', sample: 'Missed 3 sessions' },
  { name: 'Info', text: 'text-info', bg: 'bg-info-subtle', sample: 'New program available' },
] as const

const weeklyVolume = [
  { label: 'Chest', sets: 14, className: 'bg-chart-1' },
  { label: 'Back', sets: 18, className: 'bg-chart-2' },
  { label: 'Legs', sets: 20, className: 'bg-chart-3' },
  { label: 'Shoulders', sets: 10, className: 'bg-chart-4' },
  { label: 'Arms', sets: 12, className: 'bg-chart-5' },
] as const

const maxSets = Math.max(...weeklyVolume.map((item) => item.sets))

export function ColorsSection() {
  return (
    <Section
      id="colors"
      title="Color"
      description="Semantic tokens that adapt to the active theme. Components only use these tokens, never raw colour values."
    >
      <DemoGroup title="Brand" className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-h-40 flex-col justify-between rounded-card bg-primary p-5 text-primary-foreground">
          <span className="text-overline uppercase">Primary</span>
          <div>
            <p className="text-h2">Lime</p>
            <p className="numeric text-body-sm font-medium">#B5ED59 · text on lime 12:1+</p>
          </div>
        </div>
        <Card variant="muted" className="justify-center">
          <p className="text-body-sm text-foreground-muted">
            Lime is used for fills — primary buttons, progress, selected states — always with dark text on top.
            For lime-coloured text and icons, use <code className="font-mono text-foreground">text-accent</code>,
            which darkens in light mode to stay readable.
          </p>
          <p className="text-h4 text-accent">Accent text example</p>
        </Card>
      </DemoGroup>

      <DemoGroup title="Theme tokens" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {surfaceTokens.map((token) => (
          <div key={token.name} className="flex flex-col gap-2">
            <span
              className={cn('h-16 rounded-sm', token.className, token.bordered && 'border border-border')}
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-label text-foreground">{token.name}</span>
              <span className="numeric text-caption text-foreground-muted">
                {token.light} · {token.dark}
              </span>
            </div>
          </div>
        ))}
      </DemoGroup>

      <DemoGroup title="Status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusTokens.map((status) => (
          <div key={status.name} className={cn('flex flex-col gap-1 rounded-card p-4', status.bg)}>
            <span className={cn('text-label font-semibold', status.text)}>{status.name}</span>
            <span className="text-body-sm text-foreground">{status.sample}</span>
          </div>
        ))}
      </DemoGroup>

      <DemoGroup title="Chart" className="block">
        <Card>
          <div className="flex flex-col gap-1">
            <h4 className="text-h4">Weekly training volume</h4>
            <p className="text-body-sm text-foreground-muted">Working sets per muscle group</p>
          </div>
          <ul className="flex flex-col gap-3">
            {weeklyVolume.map((item) => (
              <li key={item.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                <span className="text-body-sm text-foreground">{item.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                  <span
                    className={cn('block h-full rounded-full', item.className)}
                    style={{ width: `${(item.sets / maxSets) * 100}%` }}
                  />
                </span>
                <span className="numeric text-right text-body-sm font-semibold">{item.sets}</span>
              </li>
            ))}
          </ul>
        </Card>
      </DemoGroup>
    </Section>
  )
}

const typeScale = [
  { name: 'Display', className: 'text-display', sample: 'Train smarter', spec: '36–56 · 700 · 1.05' },
  { name: 'H1', className: 'text-h1', sample: 'Weekly Progress', spec: '30–40 · 700 · 1.12' },
  { name: 'H2', className: 'text-h2', sample: 'Training Session', spec: '24–30 · 650 · 1.2' },
  { name: 'H3', className: 'text-h3', sample: 'Push Day — Upper Body', spec: '20 · 600 · 1.3' },
  { name: 'H4', className: 'text-h4', sample: 'Protein Goal', spec: '17 · 600 · 1.4' },
  {
    name: 'Body Large',
    className: 'text-body-lg',
    sample: 'You hit your protein goal five days in a row.',
    spec: '18 · 400 · 1.6',
  },
  {
    name: 'Body',
    className: 'text-body',
    sample: 'Keep rest periods around 90 seconds for hypertrophy-focused sets.',
    spec: '16 · 400 · 1.6',
  },
  { name: 'Body Small', className: 'text-body-sm', sample: 'Last logged 2 hours ago', spec: '14 · 400 · 1.5' },
  { name: 'Caption', className: 'text-caption', sample: 'Updated today at 07:42', spec: '12 · 400 · 1.4' },
  { name: 'Label', className: 'text-label', sample: 'Body weight (kg)', spec: '14 · 550 · 1.25' },
  { name: 'Overline', className: 'text-overline uppercase', sample: 'Today’s summary', spec: '11 · 600 · +8%' },
] as const

export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="Inter with a system-font fallback. Headings tighten their letter spacing as they grow; Display, H1 and H2 scale fluidly with the viewport."
    >
      <Card padding="none" className="gap-0 divide-y divide-border">
        {typeScale.map((item) => (
          <div
            key={item.name}
            className="grid gap-1 px-4 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_9rem] sm:items-baseline sm:gap-6 sm:px-6"
          >
            <span className="text-label text-foreground-muted">{item.name}</span>
            <span className={cn(item.className, 'min-w-0 break-words text-foreground')}>{item.sample}</span>
            <span className="numeric text-caption text-foreground-muted sm:text-right">{item.spec}</span>
          </div>
        ))}
      </Card>

      <DemoGroup title="Metrics — tabular numerals" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Calories today', value: '1,840', unit: 'kcal' },
          { label: 'Body weight', value: '78.4', unit: 'kg' },
          { label: 'Bench press 1RM', value: '102.5', unit: 'kg' },
        ].map((metric) => (
          <Card key={metric.label} variant="muted" padding="sm" className="gap-2">
            <span className="text-overline text-foreground-muted uppercase">{metric.label}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="numeric text-metric">{metric.value}</span>
              <span className="text-body-sm font-medium text-foreground-muted">{metric.unit}</span>
            </span>
          </Card>
        ))}
      </DemoGroup>
    </Section>
  )
}

const spacingScale = [
  { px: 4, className: 'w-1' },
  { px: 8, className: 'w-2' },
  { px: 12, className: 'w-3' },
  { px: 16, className: 'w-4' },
  { px: 24, className: 'w-6' },
  { px: 32, className: 'w-8' },
  { px: 48, className: 'w-12' },
  { px: 64, className: 'w-16' },
] as const

const radii = [
  { name: 'xs · 6', className: 'rounded-xs' },
  { name: 'sm · 8', className: 'rounded-sm' },
  { name: 'control · 12', className: 'rounded-control' },
  { name: 'card · 16', className: 'rounded-card' },
  { name: 'dialog · 20', className: 'rounded-dialog' },
  { name: 'full', className: 'rounded-full' },
] as const

export function SpacingSection() {
  return (
    <Section
      id="spacing"
      title="Spacing, shape & elevation"
      description="A 4px-based spacing scale, a small set of radii (cards default to 16px), and three restrained elevation levels."
    >
      <DemoGroup title="Spacing scale" className="block">
        <ul className="flex flex-col gap-2">
          {spacingScale.map((step) => (
            <li key={step.px} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
              <span className="numeric text-body-sm text-foreground-muted">{step.px}px</span>
              <span className={cn('h-3 rounded-xs bg-primary', step.className)} aria-hidden="true" />
            </li>
          ))}
        </ul>
      </DemoGroup>

      <DemoGroup title="Radius" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {radii.map((radius) => (
          <div key={radius.name} className="flex flex-col items-center gap-2">
            <span
              className={cn('size-16 border border-border-strong bg-surface-elevated', radius.className)}
              aria-hidden="true"
            />
            <span className="text-caption text-foreground-muted">{radius.name}</span>
          </div>
        ))}
      </DemoGroup>

      <DemoGroup title="Elevation" className="grid gap-4 sm:grid-cols-3">
        <div className="flex h-24 items-end rounded-card border border-border bg-surface p-4 shadow-card">
          <span className="text-label">shadow-card</span>
        </div>
        <div className="flex h-24 items-end rounded-card bg-surface-elevated p-4 shadow-elevated">
          <span className="text-label">shadow-elevated</span>
        </div>
        <div className="flex h-24 items-end rounded-dialog border border-border bg-surface p-4 shadow-dialog">
          <span className="text-label">shadow-dialog</span>
        </div>
      </DemoGroup>

      <dl className="grid gap-3 text-body-sm sm:grid-cols-3">
        {[
          ['Breakpoints', 'sm 640 · md 768 · lg 1024 · xl 1280'],
          ['Containers', 'prose 640 · dialog 512 · page 1152'],
          ['Motion', '160ms standard ease · reduced-motion aware'],
        ].map(([term, detail]) => (
          <div key={term} className="flex flex-col gap-0.5 rounded-card bg-surface-muted p-4">
            <dt className="text-label">{term}</dt>
            <dd className="numeric text-foreground-muted">{detail}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
