import { createBrowserRouter, type RouteObject } from 'react-router'
import { GuestOnly, OnboardingOnly, RequireAuth, RequireOnboarding } from '@/app/auth/AuthGate'
import AppShell from '@/components/layout/AppShell'
import PublicLayout from '@/components/layout/PublicLayout'
import RouteErrorFallback from '@/components/layout/RouteErrorFallback'
import RouteLoader from '@/components/layout/RouteLoader'
import { NAV_ITEMS } from '@/constants/navigation'
import { DEV_ROUTES, ROUTES } from '@/constants/routes'
import AiCoachPage from '@/pages/AiCoachPage'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import NutritionPage from '@/pages/NutritionPage'
import OnboardingPage from '@/pages/OnboardingPage'
import ProfilePage from '@/pages/ProfilePage'
import ProgressPage from '@/pages/ProgressPage'
import RegisterPage from '@/pages/RegisterPage'
import SettingsPage from '@/pages/SettingsPage'
import WorkoutsPage from '@/pages/WorkoutsPage'
import type { AppRouteHandle } from '@/types/navigation'

const handle = (title: string): AppRouteHandle => ({ title })

/**
 * Development-only routes. `import.meta.env.DEV` is `false` in production builds,
 * so Vite removes this branch and the lazily imported page is never bundled.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: DEV_ROUTES.designSystem,
        handle: handle('Design System'),
        HydrateFallback: RouteLoader,
        lazy: async () => ({
          Component: (await import('@/dev/design-system/DesignSystemPage')).default,
        }),
      },
    ]
  : []

/**
 * Route tree. Exported separately so tests can mount it in a memory router.
 *
 * Error handling: each layout renders its page inside a RouteContentBoundary
 * (page crash → fallback inside the shell); `errorElement` catches failures of
 * the layouts themselves and future loader/action errors.
 */
export const routes: RouteObject[] = [
  // Public pages: minimal layout, no app navigation. Signed-in users are sent to the app.
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: ROUTES.login, element: <LoginPage />, handle: handle('Log in') },
          { path: ROUTES.register, element: <RegisterPage />, handle: handle('Create account') },
        ],
      },
    ],
  },
  // Signed-in pages. Accounts without a fitness profile (created before FIT-12) complete
  // onboarding first; /onboarding itself is outside the app shell and its gate, so no loop.
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            element: <OnboardingOnly />,
            children: [{ path: ROUTES.onboarding, element: <OnboardingPage />, handle: handle('Complete your profile') }],
          },
        ],
      },
      {
        element: <RequireOnboarding />,
        children: [
          {
            path: ROUTES.dashboard,
            element: <AppShell />,
            errorElement: <RouteErrorFallback />,
            children: [
              { index: true, element: <DashboardPage />, handle: handle(NAV_ITEMS.dashboard.label) },
              { path: ROUTES.workouts, element: <WorkoutsPage />, handle: handle(NAV_ITEMS.workouts.label) },
              { path: ROUTES.nutrition, element: <NutritionPage />, handle: handle(NAV_ITEMS.nutrition.label) },
              { path: ROUTES.aiCoach, element: <AiCoachPage />, handle: handle(NAV_ITEMS.aiCoach.label) },
              { path: ROUTES.progress, element: <ProgressPage />, handle: handle(NAV_ITEMS.progress.label) },
              { path: ROUTES.profile, element: <ProfilePage />, handle: handle(NAV_ITEMS.profile.label) },
              { path: ROUTES.settings, element: <SettingsPage />, handle: handle(NAV_ITEMS.settings.label) },
              ...devRoutes,
              { path: '*', element: <NotFoundPage />, handle: handle('Page not found') },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
