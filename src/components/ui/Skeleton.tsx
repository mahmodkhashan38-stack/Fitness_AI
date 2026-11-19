import { cn } from '@/utils/cn'

type SkeletonShape = 'text' | 'rect' | 'circle'

const shapeClasses: Record<SkeletonShape, string> = {
  text: 'h-4 rounded-xs',
  rect: 'rounded-card',
  circle: 'rounded-full',
}

export interface SkeletonProps {
  shape?: SkeletonShape
  /** Size with Tailwind classes, e.g. "h-24 w-full" or "size-10". */
  className?: string
}

/**
 * Decorative loading placeholder (hidden from screen readers).
 * Wrap the loading region in an element with aria-busy="true" and give it
 * an accessible loading message (e.g. a <Spinner> or sr-only text).
 */
function Skeleton({ shape = 'text', className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('block animate-pulse bg-surface-elevated', shapeClasses[shape], className)}
    />
  )
}

export default Skeleton
