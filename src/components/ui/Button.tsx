import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground border-primary-edge hover:bg-primary-hover active:brightness-95',
  secondary:
    'bg-surface-elevated text-foreground border-transparent hover:bg-border active:bg-border-strong',
  outline: 'bg-transparent text-foreground border-border-strong hover:bg-hover active:bg-pressed',
  ghost: 'bg-transparent text-foreground border-transparent hover:bg-hover active:bg-pressed',
  destructive:
    'bg-danger-solid text-on-solid border-transparent hover:bg-danger-solid-hover active:brightness-95',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-body-sm font-semibold [&_svg]:size-4',
  md: 'h-11 gap-2 px-4 text-body-sm font-semibold [&_svg]:size-[1.125rem]',
  lg: 'h-13 gap-2 px-6 text-body font-semibold [&_svg]:size-5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean
  /** Replaces the label while loading. Defaults to the normal label. */
  loadingText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  ref?: Ref<HTMLButtonElement>
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  type = 'button',
  className,
  children,
  onClick,
  ref,
  ...props
}: ButtonProps) {
  // While loading the button stays focusable (aria-disabled) so keyboard focus isn't lost.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cn(
        'focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control border whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,filter,transform] duration-150 ease-standard active:scale-[0.98]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-disabled-foreground disabled:active:scale-100',
        loading && 'cursor-progress active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" label={null} /> : leftIcon}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && rightIcon}
    </button>
  )
}

export default Button
