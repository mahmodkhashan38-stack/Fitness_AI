import { ROUTES, type RoutePath } from '@/constants/routes'

export interface NavItem {
  label: string
  path: RoutePath
}

/**
 * Order for the future mobile bottom navigation (left to right).
 * Dashboard sits in the middle slot (index 2) so it renders centered.
 * The navigation UI itself is out of scope for Task 1.
 */
export const MOBILE_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Progress', path: ROUTES.progress },
  { label: 'Workouts', path: ROUTES.workouts },
  { label: 'Dashboard', path: ROUTES.dashboard },
  { label: 'Nutrition', path: ROUTES.nutrition },
  { label: 'AI Coach', path: ROUTES.aiCoach },
] as const
