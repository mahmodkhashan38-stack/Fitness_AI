import { useEffect } from 'react'
import { useMatches } from 'react-router'
import type { AppRouteHandle } from '@/types/navigation'

const APP_NAME = 'Fitness AI'

function isRouteHandle(value: unknown): value is AppRouteHandle {
  return typeof value === 'object' && value !== null && typeof (value as AppRouteHandle).title === 'string'
}

/** Title of the deepest matched route that defines `handle.title`. */
export function usePageTitle(fallback = APP_NAME): string {
  const matches = useMatches()
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const routeHandle = matches[index]?.handle
    if (isRouteHandle(routeHandle)) return routeHandle.title
  }
  return fallback
}

/** Keeps the browser tab title in sync, e.g. "Workouts · Fitness AI". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`
  }, [title])
}
