import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  icon: LucideIcon
  description?: string
}

function PlaceholderPage({ title, icon: Icon, description }: PlaceholderPageProps) {
  return (
    <section className="flex flex-col items-start gap-3">
      <Icon className="size-8 text-primary-600 dark:text-primary-400" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        {description ?? 'This page is a placeholder and will be built in a later task.'}
      </p>
    </section>
  )
}

export default PlaceholderPage
