export const ROUTES = {
  dashboard: '/',
  login: '/login',
  register: '/register',
  workouts: '/workouts',
  nutrition: '/nutrition',
  aiCoach: '/ai-coach',
  progress: '/progress',
  profile: '/profile',
  settings: '/settings',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
