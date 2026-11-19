import {
  cloneElement,
  useEffect,
  useId,
  useState,
  type HTMLAttributes,
  type ReactElement,
} from 'react'
import { cn } from '@/utils/cn'

type TooltipSide = 'top' | 'bottom'
type TooltipAlign = 'center' | 'start' | 'end'

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
}

const alignClasses: Record<TooltipAlign, string> = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0',
}

export interface TooltipProps {
  /** Short supplementary text. Don't put essential information only in a tooltip. */
  content: string
  /** A single focusable element (e.g. a button). It receives aria-describedby. */
  children: ReactElement<HTMLAttributes<HTMLElement>>
  side?: TooltipSide
  align?: TooltipAlign
  className?: string
}

/**
 * Shows on hover and keyboard focus, hides on blur, pointer leave or Escape
 * (WCAG 1.4.13). The tooltip stays open while the pointer is over it.
 */
function Tooltip({ content, children, side = 'top', align = 'center', className }: TooltipProps) {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const existingDescribedBy = children.props['aria-describedby']
  const trigger = cloneElement(children, {
    'aria-describedby': cn(existingDescribedBy, tooltipId),
  })

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'absolute z-50 w-max max-w-56 rounded-sm bg-foreground px-2.5 py-1.5 text-caption font-medium text-background shadow-elevated',
          'transition-[opacity,visibility] duration-150 ease-standard',
          open ? 'visible opacity-100 delay-150' : 'invisible opacity-0',
          sideClasses[side],
          alignClasses[align],
          className,
        )}
      >
        {content}
      </span>
    </span>
  )
}

export default Tooltip
