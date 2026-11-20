import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuestOnly, OnboardingOnly, RequireAuth, RequireOnboarding } from '@/app/auth/AuthGate'
import type { AuthContextValue } from '@/hooks/useAuth'
import { createAuthValue, TEST_USER, TestAuthProvider } from '@/test/auth'

function renderAt(path: string, auth: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { element: <GuestOnly />, children: [{ path: '/login', element: <h1>Log in</h1> }] },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <h1>Dashboard</h1> },
          { path: '/workouts', element: <h1>Workouts</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <TestAuthProvider value={auth}>
      <RouterProvider router={router} />
    </TestAuthProvider>,
  )
  return router
}

afterEach(() => vi.restoreAllMocks())

describe('RequireAuth', () => {
  it('renders protected pages for signed-in users', () => {
    renderAt('/workouts', createAuthValue())
    expect(screen.getByRole('heading', { name: 'Workouts' })).toBeTruthy()
  })

  it('sends signed-out users to login and remembers where they were going', () => {
    const router = renderAt('/workouts?week=3', createAuthValue({ status: 'unauthenticated' }))
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?redirect=%2Fworkouts%3Fweek%3D3')
  })

  it('omits the redirect for the dashboard', () => {
    const router = renderAt('/', createAuthValue({ status: 'unauthenticated' }))
    expect(router.state.location.search).toBe('')
  })

  it('shows a session check while loading, with a cold-start hint when slow', () => {
    renderAt('/workouts', createAuthValue({ status: 'loading' }))
    expect(screen.getByRole('status').textContent).toBe('Checking your session…')
    expect(screen.queryByRole('heading', { name: 'Workouts' })).toBeNull()
  })

  it('mentions the slow server start', () => {
    renderAt('/workouts', createAuthValue({ status: 'loading', slow: true }))
    expect(screen.getByRole('status').textContent).toMatch(/Waking up Fitness AI/)
  })

  it('when the server is unreachable: no protected content, no logout, a retry action', () => {
    const auth = createAuthValue({ status: 'unavailable' })
    const router = renderAt('/workouts', auth)
    expect(screen.queryByRole('heading', { name: 'Workouts' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Can’t reach Fitness AI' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/workouts')
    act(() => screen.getByRole('button', { name: 'Try again' }).click())
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  it('says so when the device is offline (installed PWA opened without a connection)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderAt('/workouts', createAuthValue({ status: 'unavailable' }))
    expect(screen.getByRole('heading', { level: 1, name: 'You’re offline' })).toBeTruthy()
    expect(screen.getByText(/reconnect automatically/)).toBeTruthy()
  })
})

describe('GuestOnly', () => {
  it('shows the login page to signed-out users', () => {
    renderAt('/login', createAuthValue({ status: 'unauthenticated' }))
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy()
  })

  it('sends signed-in users to the requested page', () => {
    const router = renderAt('/login?redirect=%2Fworkouts', createAuthValue())
    expect(router.state.location.pathname).toBe('/workouts')
  })

  it.each(['https://evil.example.com', '//evil.example.com', '/login'])('ignores an unsafe redirect (%s)', (redirect) => {
    const router = renderAt(`/login?redirect=${encodeURIComponent(redirect)}`, createAuthValue())
    expect(router.state.location.pathname).toBe('/')
  })
})

/** The production arrangement of the gates (see router.tsx), with stand-in pages. */
function renderOnboardingGates(path: string, auth: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { element: <GuestOnly />, children: [{ path: '/login', element: <h1>Log in</h1> }] },
      {
        element: <RequireAuth />,
        children: [
          { element: <OnboardingOnly />, children: [{ path: '/onboarding', element: <h1>Complete your profile</h1> }] },
          {
            element: <RequireOnboarding />,
            children: [
              { path: '/', element: <h1>Dashboard</h1> },
              { path: '/workouts', element: <h1>Workouts</h1> },
              { path: '/profile', element: <h1>Profile</h1> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <TestAuthProvider value={auth}>
      <RouterProvider router={router} />
    </TestAuthProvider>,
  )
  return router
}

const pending = () => createAuthValue({ user: { ...TEST_USER, onboardingCompleted: false } })

describe('onboarding gates (accounts without a fitness profile)', () => {
  it.each(['/workouts', '/profile'])('send %s to onboarding and remember the destination', (path) => {
    const router = renderOnboardingGates(path, pending())
    expect(screen.getByRole('heading', { name: 'Complete your profile' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/onboarding')
    expect(router.state.location.search).toBe(`?redirect=${encodeURIComponent(path)}`)
  })

  it('omits the redirect for the dashboard', () => {
    const router = renderOnboardingGates('/', pending())
    expect(router.state.location.pathname).toBe('/onboarding')
    expect(router.state.location.search).toBe('')
  })

  it('shows onboarding to a pending user who opens it directly', () => {
    renderOnboardingGates('/onboarding', pending())
    expect(screen.getByRole('heading', { name: 'Complete your profile' })).toBeTruthy()
  })

  it('sends completed users from onboarding to the requested page', () => {
    const router = renderOnboardingGates('/onboarding?redirect=%2Fworkouts', createAuthValue())
    expect(router.state.location.pathname).toBe('/workouts')
  })

  it.each(['/onboarding', 'https://evil.example.com', '/login'])('never loops or leaves the app (redirect=%s)', (redirect) => {
    const router = renderOnboardingGates(`/onboarding?redirect=${encodeURIComponent(redirect)}`, createAuthValue())
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy()
  })

  it('lets completed users use the app normally', () => {
    renderOnboardingGates('/workouts', createAuthValue())
    expect(screen.getByRole('heading', { name: 'Workouts' })).toBeTruthy()
  })

  it('signed-out users go to login first, not to onboarding', () => {
    const router = renderOnboardingGates('/onboarding', createAuthValue({ status: 'unauthenticated' }))
    expect(router.state.location.pathname).toBe('/login')
  })
})
