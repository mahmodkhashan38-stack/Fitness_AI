import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type IconButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground border-primary-edge hover:bg-primary-hover',
  secondary: 'bg-surface-elevated text-foreground border-transparent hover:bg-border',
  outline: 'bg-transparent text-foreground border-border-strong hover:bg-hover',
  ghost: 'bg-transparent text-foreground-muted border-transparent hover:bg-hover hover:text-foreground',
  destructive: 'bg-danger-solid text-on-solid border-transparent hover:bg-danger-solid-hover',
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'size-9 [&_svg]:size-4',
  md: 'size-11 [&_svg]:size-5',
  lg: 'size-13 [&_svg]:size-6',
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name — required because the button has no visible text. */
  label: string
  icon: ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  className,
  onClick,
  ref,
  ...props
}: IconButtonProps) {
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
      aria-label={label}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cn(
        'focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control border',
        'transition-[background-color,border-color,color,transform] duration-150 ease-standard active:scale-95',
        'disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled disabled:text-disabled-foreground',
        loading && 'cursor-progress',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" label={null} /> : icon}
    </button>
  )
}

export default IconButton
