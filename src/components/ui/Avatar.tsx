import { UserRound } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'size-8 text-caption',
  md: 'size-10 text-body-sm',
  lg: 'size-14 text-body-lg',
  xl: 'size-20 text-h3',
}

export interface AvatarProps {
  /** Person's name: used for the alt text and the initials fallback. */
  name: string
  src?: string
  size?: AvatarSize
  /**
   * What to show without a photo: the person's initials (default) or a neutral user silhouette
   * (the default profile picture; never derived from the person's data).
   */
  fallback?: 'initials' | 'silhouette'
  className?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/** Shows a photo, falling back to initials or a silhouette when there is no image or it fails to load. */
function Avatar({ name, src, size = 'md', fallback = 'initials', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-primary-subtle font-semibold text-accent ring-1 ring-border',
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span role="img" aria-label={name} className="flex size-full items-center justify-center">
          {fallback === 'silhouette' ? (
            <UserRound aria-hidden="true" className="size-[55%]" strokeWidth={1.75} />
          ) : (
            <span aria-hidden="true">{getInitials(name)}</span>
          )}
        </span>
      )}
    </span>
  )
}

export default Avatar
