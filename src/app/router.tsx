import { createBrowserRouter } from 'react-router'
import RootLayout from '@/components/layout/RootLayout'
import { ROUTES } from '@/constants/routes'
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
