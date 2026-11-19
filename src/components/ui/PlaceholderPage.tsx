import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  icon: LucideIcon
  description?: string
}

function PlaceholderPage({ title, icon: Icon, description }: PlaceholderPageProps) {
  return (
    <section className="flex flex-col items-start gap-3">
      <Icon className="size-8 text-accent" aria-hidden="true" />
      <h1 className="text-h1 text-foreground">{title}</h1>
      <p className="text-body text-foreground-muted">
        {description ?? 'This page is a placeholder and will be built in a later task.'}
      </p>
    </section>
  )
}

export default PlaceholderPage
