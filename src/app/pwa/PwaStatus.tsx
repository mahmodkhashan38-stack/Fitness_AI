import ServiceWorkerUpdates from '@/app/pwa/ServiceWorkerUpdates'
import OfflineIndicator from '@/components/feedback/OfflineIndicator'

/**
 * Bottom-centred region for app-level status (offline, update available).
 * Sits above the mobile bottom navigation and the safe area; never blocks the page.
 */
function PwaStatus() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-50 flex flex-col items-center gap-2 px-[max(1rem,env(safe-area-inset-left))] md:bottom-6">
      <div className="flex w-full max-w-md flex-col items-center gap-2">
        <OfflineIndicator />
        <ServiceWorkerUpdates />
      </div>
    </div>
  )
}

export default PwaStatus
