import { Construction, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import EmptyState from '@/components/ui/EmptyState'

interface PlaceholderPageProps {
  title: string
  icon: LucideIcon
  description: string
  /** Optional content below the header, replacing the default "coming soon" panel. */
  children?: ReactNode
}

/** Consistent page header + content container used until each feature screen is built. */
function PlaceholderPage({ title, icon: Icon, description, children }: PlaceholderPageProps) {
  return (
    <section className="flex flex-col gap-6 md:gap-8" aria-labelledby="page-title">
      <header className="flex items-start gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-card bg-primary-subtle text-accent md:size-14"
          aria-hidden="true"
        >
          <Icon className="size-6 md:size-7" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 id="page-title" className="text-h1 text-foreground">
            {title}
          </h1>
          <p className="max-w-prose text-body text-foreground-muted">{description}</p>
        </div>
      </header>

      {children ?? (
        <div className="rounded-card border border-dashed border-border-strong bg-surface">
          <EmptyState
            icon={<Construction />}
            title="Coming in a future sprint"
            description="This screen is a placeholder. The layout and navigation are ready for it."
            headingLevel="h2"
          />
        </div>
      )}
    </section>
  )
}

export default PlaceholderPage
