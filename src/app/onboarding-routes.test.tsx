import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import ThemeProvider from '@/app/providers/ThemeProvider'
import { routes } from '@/app/router'
import type { AuthContextValue } from '@/hooks/useAuth'
import { createAuthValue, TEST_USER, TestAuthProvider } from '@/test/auth'

function renderApp(path: string, auth: AuthContextValue) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ThemeProvider>
      <TestAuthProvider value={auth}>
        <RouterProvider router={router} />
      </TestAuthProvider>
    </ThemeProvider>,
  )
  return router
}

const pending = (overrides: Partial<AuthContextValue> = {}) =>
  createAuthValue({ user: { ...TEST_USER, onboardingCompleted: false }, ...overrides })

describe('real routes for an account without a fitness profile', () => {
  it.each(['/', '/workouts', '/nutrition', '/ai-coach', '/progress', '/profile', '/settings'])(
    '%s shows onboarding instead of the app, without app navigation',
    (path) => {
      const router = renderApp(path, pending())
      expect(router.state.location.pathname).toBe('/onboarding')
      expect(screen.getByRole('heading', { level: 1, name: 'Complete your profile' })).toBeTruthy()
      expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
      expect(document.title).toContain('Complete your profile')
    },
  )

  it('can always log out', async () => {
    const logout = vi.fn(async () => {})
    // Like the real provider: logging out changes the auth state.
    function StatefulAuth({ children }: { children: ReactNode }) {
      const [signedIn, setSignedIn] = useState(true)
      const value = signedIn
        ? pending({
            logout: async () => {
              await logout()
              setSignedIn(false)
            },
          })
        : createAuthValue({ status: 'unauthenticated' })
      return <TestAuthProvider value={value}>{children}</TestAuthProvider>
    }
    const router = createMemoryRouter(routes, { initialEntries: ['/workouts'] })
    render(
      <ThemeProvider>
        <StatefulAuth>
          <RouterProvider router={router} />
        </StatefulAuth>
      </ThemeProvider>,
    )
    await act(async () => screen.getByRole('button', { name: /Log out/ }).click())
    expect(logout).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeTruthy()
  })

  it('reports a failed logout instead of pretending', async () => {
    const auth = pending({ logout: vi.fn(async () => Promise.reject(new Error('offline'))) })
    const router = renderApp('/onboarding', auth)
    await act(async () => screen.getByRole('button', { name: /Log out/ }).click())
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t log out/)
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('a completed account never sees onboarding', () => {
    const router = renderApp('/onboarding', createAuthValue())
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
  })

  it('after saving the profile, continues to the page the user wanted, inside the app', async () => {
    const save = vi.fn<(profile: unknown) => Promise<void>>(async () => {})
    function StatefulAuth({ children }: { children: ReactNode }) {
      const [done, setDone] = useState(false)
      const value = createAuthValue({
        user: { ...TEST_USER, onboardingCompleted: done },
        completeOnboarding: async (profile) => {
          await save(profile)
          setDone(true)
        },
      })
      return <TestAuthProvider value={value}>{children}</TestAuthProvider>
    }
    const router = createMemoryRouter(routes, { initialEntries: ['/workouts?week=2'] })
    render(
      <ThemeProvider>
        <StatefulAuth>
          <RouterProvider router={router} />
        </StatefulAuth>
      </ThemeProvider>,
    )
    expect(router.state.location.pathname).toBe('/onboarding')

    const choose = (group: RegExp, option: string) =>
      act(async () => within(screen.getByRole('group', { name: group })).getByRole('radio', { name: option }).click())
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } })
    await choose(/^Sex/, 'Female')
    type('Age', '33')
    type('Height', '165')
    type('Weight', '58')
    await choose(/^Main goal/, 'Maintenance')
    await choose(/^Training days per week/, '2')
    await act(async () => screen.getByRole('button', { name: 'Save and continue' }).click())

    expect(save).toHaveBeenCalledWith({ sex: 'female', age: 33, heightCm: 165, weightKg: 58, goal: 'maintenance', trainingDaysPerWeek: 2 })
    await waitFor(() => expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/workouts?week=2'))
    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeTruthy()
    expect(screen.getAllByRole('navigation', { name: 'Primary' }).length).toBeGreaterThan(0)
  })
})
