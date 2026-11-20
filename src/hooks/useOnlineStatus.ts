import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getSnapshot = () => navigator.onLine
// Server rendering is not used; assume online so nothing "offline" flashes.
const getServerSnapshot = () => true

/**
 * Whether the browser reports a network connection.
 * `false` reliably means offline; `true` only means a network interface is up
 * (e.g. Wi-Fi without internet still reports online), so API errors must still be handled.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
