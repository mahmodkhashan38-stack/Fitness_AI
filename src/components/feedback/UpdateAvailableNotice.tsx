import { RefreshCw } from 'lucide-react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

export interface UpdateAvailableNoticeProps {
  /** Activates the new version and reloads the page. */
  onReload: () => void
  /** Hides the notice; the update is applied the next time the app is opened. */
  onDismiss: () => void
  reloading?: boolean
  className?: string
}

/** Non-modal notice that a new app version has been downloaded. Never reloads on its own. */
function UpdateAvailableNotice({ onReload, onDismiss, reloading = false, className }: UpdateAvailableNoticeProps) {
  return (
    <Alert
      variant="info"
      title="A new version of Fitness AI is available"
      live
      onDismiss={onDismiss}
      className={cn('pointer-events-auto border border-border shadow-elevated', className)}
      action={
        <Button
          size="sm"
          onClick={onReload}
          loading={reloading}
          loadingText="Updating…"
          leftIcon={<RefreshCw aria-hidden="true" />}
        >
          Reload to update
        </Button>
      }
    >
      Reload when it suits you. Otherwise it updates the next time you open the app.
    </Alert>
  )
}

export default UpdateAvailableNotice
