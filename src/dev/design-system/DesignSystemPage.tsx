import { Badge, ThemeToggle } from '@/components/ui'
import { ActionsSection } from '@/dev/design-system/sections/ActionsSection'
import { CardsSection } from '@/dev/design-system/sections/CardsSection'
import {
  AlertsSection,
  DialogSection,
  EmptyStatesSection,
  LoadingSection,
  ProgressSection,
} from '@/dev/design-system/sections/FeedbackSection'
import { FormsSection } from '@/dev/design-system/sections/FormsSection'
import { ColorsSection, SpacingSection, TypographySection } from '@/dev/design-system/sections/FoundationsSection'
import { OrganizationSection } from '@/dev/design-system/sections/OrganizationSection'
import { ThemeSection } from '@/dev/design-system/sections/ThemeSection'

const contents = [
  { id: 'theme', label: 'Theme' },
  { id: 'colors', label: 'Color' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'cards', label: 'Cards' },
  { id: 'forms', label: 'Forms' },
  { id: 'navigation', label: 'Tabs & badges' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'progress', label: 'Progress' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty-states', label: 'Empty states' },
  { id: 'dialogs', label: 'Dialog' },
] as const

/**
 * Internal design-system reference. Registered only in development builds
 * (see src/app/router.tsx) and excluded from the production bundle.
 */
function DesignSystemPage() {
  return (
    <div className="flex flex-col gap-10 pb-16 sm:gap-12">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-prose flex-col gap-3">
            <Badge variant="outline" className="uppercase">
              Internal · Development only
            </Badge>
            <h1 className="text-display text-foreground">
              Fitness AI <span className="text-accent">Design System</span>
            </h1>
            <p className="text-body-lg text-foreground-muted">
              Tokens, typography and shared components for every Fitness AI screen. Check both themes and
              keyboard behaviour here before using a component in a feature.
            </p>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>
        <nav aria-label="Design system sections">
          <ul className="flex flex-wrap gap-2">
            {contents.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="focus-ring inline-flex h-9 items-center rounded-full border border-border bg-surface px-3.5 text-label text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <ThemeSection />
      <ColorsSection />
      <TypographySection />
      <SpacingSection />
      <ActionsSection />
      <CardsSection />
      <FormsSection />
      <OrganizationSection />
      <AlertsSection />
      <ProgressSection />
      <LoadingSection />
      <EmptyStatesSection />
      <DialogSection />
    </div>
  )
}

export default DesignSystemPage
