import {
  Bot,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  House,
  Settings,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { AppNavId, AppNavItem } from '@/types/navigation'

/**
 * Single source of truth for app navigation: labels, paths, icons and page descriptions.
 * The sidebar, bottom navigation, header title and placeholder pages all read from here.
 */
export const NAV_ITEMS: Readonly<Record<AppNavId, AppNavItem>> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    path: ROUTES.dashboard,
    icon: House,
    description: 'Your daily overview: training, nutrition and recovery at a glance.',
  },
  workouts: {
    id: 'workouts',
    label: 'Workouts',
    path: ROUTES.workouts,
    icon: Dumbbell,
    description: 'Plan, log and review your training sessions.',
  },
  nutrition: {
    id: 'nutrition',
    label: 'Nutrition',
    path: ROUTES.nutrition,
    icon: UtensilsCrossed,
    description: 'Track meals, calories and macros against your goals.',
  },
  progress: {
    id: 'progress',
    label: 'Progress',
    path: ROUTES.progress,
    icon: ChartNoAxesColumnIncreasing,
    description: 'See how your body weight, strength and consistency trend over time.',
  },
  aiCoach: {
    id: 'aiCoach',
    label: 'AI Coach',
    path: ROUTES.aiCoach,
    icon: Bot,
    description: 'Personalised guidance for your training and nutrition.',
  },
  profile: {
    id: 'profile',
    label: 'Profile',
    path: ROUTES.profile,
    icon: UserRound,
    description: 'Your personal details, goals and body measurements.',
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    path: ROUTES.settings,
    icon: Settings,
    description: 'Units, appearance, notifications and account preferences.',
  },
}

/** Desktop sidebar — primary section (top to bottom). */
export const SIDEBAR_PRIMARY_NAV: readonly AppNavId[] = ['dashboard', 'workouts', 'nutrition', 'progress', 'aiCoach']

/** Desktop sidebar — secondary "Account" section. */
export const SIDEBAR_SECONDARY_NAV: readonly AppNavId[] = ['profile', 'settings']

/**
 * Mobile bottom navigation (left to right).
 * Dashboard is the 3rd of 5 equal columns, so it is always exactly centred.
 */
export const MOBILE_NAV: readonly AppNavId[] = ['progress', 'workouts', 'dashboard', 'nutrition', 'aiCoach']

/** The item rendered as the emphasised centre action in the bottom navigation. */
export const MOBILE_NAV_CENTER: AppNavId = 'dashboard'
