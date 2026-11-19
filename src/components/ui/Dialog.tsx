import { X } from 'lucide-react'
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

type DialogSize = 'sm' | 'md' | 'lg'

const sizeClasses: Record<DialogSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-dialog',
  lg: 'sm:max-w-2xl',
}

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  /** Action buttons, rendered right-aligned (stacked full-width on mobile). */
  footer?: ReactNode
  size?: DialogSize
  /** Close when the backdrop is clicked. Escape always closes. */
  closeOnBackdropClick?: boolean
  /** Use role="alertdialog" for confirmations that need an explicit answer. */
  alert?: boolean
  className?: string
}

/**
 * Modal dialog built on the native <dialog> element:
 * showModal() makes the page behind inert, traps Tab focus, closes on Escape
 * and returns focus to the trigger. On small screens it opens as a bottom sheet.
 * Add `data-autofocus` to the element that should receive focus first
 * (defaults to the first focusable element, the close button).
 */
function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  alert = false,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pointerDownOnBackdrop = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // React's autoFocus doesn't apply inside a dialog that wasn't open yet,
      // so mark the element to focus first with `data-autofocus`.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Lock page scroll while open.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  const onBackdropPointerDown = (event: MouseEvent<HTMLDialogElement>) => {
    pointerDownOnBackdrop.current = event.target === event.currentTarget
  }

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    const startedOnBackdrop = pointerDownOnBackdrop.current
    pointerDownOnBackdrop.current = false
    if (closeOnBackdropClick && startedOnBackdrop && event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      role={alert ? 'alertdialog' : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onMouseDown={onBackdropPointerDown}
      onClick={onBackdropClick}
      className={cn(
        'fa-dialog m-0 max-h-none w-full max-w-none bg-transparent p-0 text-foreground',
        'fixed inset-x-0 top-auto bottom-0',
        'sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)]',
        'backdrop:backdrop-blur-[2px]',
        sizeClasses[size],
      )}
    >
      <div
        className={cn(
          'flex max-h-[min(90dvh,48rem)] flex-col border border-border bg-surface shadow-dialog',
          'rounded-t-dialog sm:rounded-dialog',
          className,
        )}
      >
        <span className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-2 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id={titleId} className="text-h3 text-foreground">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="text-body-sm text-foreground-muted">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="focus-ring -mt-1 -mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-foreground-muted transition-colors hover:bg-hover hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">{children}</div>}

        {footer && (
          <footer className="flex flex-col-reverse gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-6 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </footer>
        )}
        {!footer && <div className="h-[max(1.25rem,env(safe-area-inset-bottom))] sm:h-6" aria-hidden="true" />}
      </div>
    </dialog>
  )
}

export default Dialog
