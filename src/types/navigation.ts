import type { LucideIcon } from 'lucide-react'
import type { RoutePath } from '@/constants/routes'

export type AppNavId = 'dashboard' | 'workouts' | 'nutrition' | 'progress' | 'aiCoach' | 'profile' | 'settings'

export interface AppNavItem {
  id: AppNavId
  /** Label used in navigation and as the page title. */
  label: string
  /** Shorter label for tight spaces (mobile bottom bar, tablet rail). */
  shortLabel?: string
  path: RoutePath
  icon: LucideIcon
  /** One-line page description shown under the page title. */
  description: string
}

/** Data attached to routes via React Router's `handle`. */
export interface AppRouteHandle {
  title: string
}
