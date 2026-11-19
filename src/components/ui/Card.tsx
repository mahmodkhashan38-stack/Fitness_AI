import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type CardVariant = 'default' | 'elevated' | 'muted' | 'outline'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-surface border border-border shadow-card',
  elevated: 'bg-surface-elevated border border-transparent shadow-elevated',
  muted: 'bg-surface-muted border border-transparent',
  outline: 'bg-transparent border border-border-strong',
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant
  padding?: CardPadding
  /** Render as a semantic element. */
  as?: 'div' | 'section' | 'article'
}

export function Card({ variant = 'default', padding = 'md', as: Tag = 'div', className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'flex flex-col gap-4 rounded-card text-foreground',
        variantClasses[variant],
        paddingClasses[padding],
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3', className)} {...props} />
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4'
}

export function CardTitle({ as: Tag = 'h3', className, ...props }: CardTitleProps) {
  return <Tag className={cn('text-h4 text-foreground', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body-sm text-foreground-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-3', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center gap-3 pt-1', className)} {...props} />
}
