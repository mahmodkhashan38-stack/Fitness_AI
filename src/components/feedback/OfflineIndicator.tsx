import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export interface OfflineIndicatorProps {
  className?: string
}

/**
 * Small, non-blocking notice shown while the device is offline.
 * The live region is always rendered so screen readers announce the change.
 */
function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const online = useOnlineStatus()

  return (
    <div role="status" className={className}>
      {!online && (
        <p className="pointer-events-auto flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-2 text-body-sm font-medium text-foreground shadow-elevated">
          <WifiOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
          You’re offline. Changes and new data need a connection.
        </p>
      )}
    </div>
  )
}

export default OfflineIndicator
