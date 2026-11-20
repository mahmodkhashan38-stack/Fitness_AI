import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import UpdateAvailableNotice from '@/components/feedback/UpdateAvailableNotice'

/** How often an open app checks for a new version (in addition to page loads and returning to the app). */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

/**
 * Registers the service worker (production builds only; a no-op in development and tests)
 * and offers new versions to the user. Updates are never applied without the user's action,
 * so a page never switches versions mid-session.
 */
function ServiceWorkerUpdates() {
  const [update, setUpdate] = useState<UpdateServiceWorker | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    let interval: number | undefined
    let registration: ServiceWorkerRegistration | undefined

    const checkForUpdate = () => {
      if (!registration || registration.installing || !navigator.onLine) return
      registration.update().catch(() => {
        // Offline or server unreachable: try again at the next check.
      })
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }

    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        setDismissed(false)
        setUpdate(() => updateServiceWorker)
      },
      onRegisteredSW(_url, swRegistration) {
        registration = swRegistration
        interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
        document.addEventListener('visibilitychange', onVisibilityChange)
      },
      onRegisterError(error: unknown) {
        // The app works without a service worker (no offline support); nothing to show the user.
        if (import.meta.env.DEV) console.error('Service worker registration failed', error)
      },
    })

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (!update || dismissed) return null

  return (
    <UpdateAvailableNotice
      reloading={reloading}
      onDismiss={() => setDismissed(true)}
      onReload={() => {
        setReloading(true)
        // Activates the waiting service worker; the page reloads once it takes control.
        void update(true)
      }}
    />
  )
}

export default ServiceWorkerUpdates
