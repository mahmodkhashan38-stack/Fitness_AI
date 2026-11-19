import { Activity } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface BrandLogoProps {
  /** Show the "Fitness AI" wordmark next to the mark. */
  showWordmark?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** Fitness AI mark (lime tile) with optional wordmark. */
function BrandLogo({ showWordmark = true, size = 'md', className }: BrandLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center bg-primary text-primary-foreground',
          size === 'sm' ? 'size-8 rounded-[0.625rem] [&_svg]:size-[1.125rem]' : 'size-9 rounded-control [&_svg]:size-5',
        )}
        aria-hidden="true"
      >
        <Activity strokeWidth={2.5} />
      </span>
      {showWordmark ? (
        <span className="text-h4 font-bold tracking-tight text-foreground">
          Fitness<span className="text-accent"> AI</span>
        </span>
      ) : (
        <span className="sr-only">Fitness AI</span>
      )}
    </span>
  )
}

export default BrandLogo
