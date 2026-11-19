import { createBrowserRouter, type RouteObject } from 'react-router'
import RootLayout from '@/components/layout/RootLayout'
import RouteLoader from '@/components/layout/RouteLoader'
import { DEV_ROUTES, ROUTES } from '@/constants/routes'
import AiCoachPage from '@/pages/AiCoachPage'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import NutritionPage from '@/pages/NutritionPage'
import ProfilePage from '@/pages/ProfilePage'
import ProgressPage from '@/pages/ProgressPage'
import RegisterPage from '@/pages/RegisterPage'
import SettingsPage from '@/pages/SettingsPage'
import WorkoutsPage from '@/pages/WorkoutsPage'

/**
 * Development-only routes. `import.meta.env.DEV` is `false` in production builds,
 * so Vite removes this branch and the lazily imported page is never bundled.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: DEV_ROUTES.designSystem,
        HydrateFallback: RouteLoader,
        lazy: async () => ({
          Component: (await import('@/dev/design-system/DesignSystemPage')).default,
        }),
      },
    ]
  : []

export const router = createBrowserRouter([
  {
    path: ROUTES.dashboard,
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: ROUTES.login, element: <LoginPage /> },
      { path: ROUTES.register, element: <RegisterPage /> },
      { path: ROUTES.workouts, element: <WorkoutsPage /> },
      { path: ROUTES.nutrition, element: <NutritionPage /> },
      { path: ROUTES.aiCoach, element: <AiCoachPage /> },
      { path: ROUTES.progress, element: <ProgressPage /> },
      { path: ROUTES.profile, element: <ProfilePage /> },
      { path: ROUTES.settings, element: <SettingsPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
