import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface SectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** Layout wrapper for one showcase section. */
export function Section({ id, title, description, children, className }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-border pt-10 sm:pt-12">
      <header className="mb-6 flex max-w-prose flex-col gap-2">
        <h2 id={`${id}-title`} className="text-h2 text-foreground">
          {title}
        </h2>
        {description && <p className="text-body text-foreground-muted">{description}</p>}
      </header>
      <div className={cn('flex flex-col gap-6', className)}>{children}</div>
    </section>
  )
}

interface DemoGroupProps {
  title: string
  children: ReactNode
  /** Layout classes for the content. Replaces the default wrapping row when provided. */
  className?: string
}

/** Small labelled group inside a section. */
export function DemoGroup({ title, children, className }: DemoGroupProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-overline text-foreground-muted uppercase">{title}</h3>
      <div className={className ?? 'flex flex-wrap items-center gap-3'}>{children}</div>
    </div>
  )
}
