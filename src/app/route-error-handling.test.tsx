/**
 * Integration tests against the real route tree (app/router.tsx), with
 * crashing test routes injected into the app shell and public layout.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/app/App'
import ThemeProvider from '@/app/providers/ThemeProvider'
import { routes } from '@/app/router'
import { TestAuthProvider } from '@/test/auth'

let pageShouldThrow = true
function CrashingPage() {
  if (pageShouldThrow) throw new Error('page render failed: secret-internal-detail')
  return <h1>Recovered page</h1>
}
function CrashingLayout(): never {
  throw new Error('layout render failed')
}

/** Adds child routes to a layout route. Index routes can't have children, so they're returned unchanged. */
function addChildren(route: RouteObject, extra: RouteObject[]): RouteObject {
  return route.index ? route : { ...route, children: [...extra, ...(route.children ?? [])] }
}

/** Copies the real routes and adds test-only routes to the app shell (path "/", nested inside RequireAuth). */
function withTestRoutes(extraAppRoutes: RouteObject[], extraTopLevel: RouteObject[] = []): RouteObject[] {
  const inject = (route: RouteObject): RouteObject =>
    route.path === '/' ? addChildren(route, extraAppRoutes) : route.children ? { ...route, children: route.children.map(inject) } : route
  return [...routes.map(inject), ...extraTopLevel]
}

function renderAt(path: string, routeTree: RouteObject[]) {
  const router = createMemoryRouter(routeTree, { initialEntries: [path] })
  render(
    <ThemeProvider>
      <TestAuthProvider>
        <RouterProvider router={router} />
      </TestAuthProvider>
    </ThemeProvider>,
  )
  return router
}

const primaryNavs = () => screen.getAllByRole('navigation', { name: 'Primary' })

beforeEach(() => {
  pageShouldThrow = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('route-level error isolation', () => {
  it('a crashing page shows a fallback inside the shell; navigation keeps working', async () => {
    renderAt('/crash', withTestRoutes([{ path: 'crash', element: <CrashingPage /> }]))

    const alert = screen.getByRole('alert', { name: 'This page couldn’t be displayed' })
    expect(alert).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'This page couldn’t be displayed' })).toBeTruthy() // page keeps an h1
    expect(primaryNavs().length).toBeGreaterThan(0) // shell still rendered
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('Unexpected Application Error') // router's default screen
    expect(document.body.textContent).not.toMatch(/\bat CrashingPage\b/) // no stack trace

    // Navigate with the real sidebar link: the error clears and the new page renders.
    const workoutsLinks = screen.getAllByRole('link', { name: 'Workouts' })
    await act(async () => fireEvent.click(workoutsLinks[0]!))
    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a page that always fails never traps the user: retry stays bounded and the fallback link escapes', async () => {
    let attempts = 0
    function AlwaysFails(): never {
      attempts += 1
      throw new Error('always fails')
    }
    renderAt('/always-fails', withTestRoutes([{ path: 'always-fails', element: <AlwaysFails /> }]))
    for (let click = 0; click < 3; click += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(screen.getByRole('alert', { name: 'This page couldn’t be displayed' })).toBeTruthy()
    }
    const settled = attempts
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(attempts).toBe(settled) // no background retry loop

    // Escape 1: the fallback's own "Go to Dashboard" link.
    await act(async () => fireEvent.click(screen.getByRole('link', { name: 'Go to Dashboard' })))
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('if the Dashboard itself always fails, the shell navigation still leads elsewhere', async () => {
    function AlwaysFails(): never {
      throw new Error('dashboard always fails')
    }
    const replaceDashboard = (route: RouteObject): RouteObject => {
      if (route.index) return route
      if (route.path === '/') {
        const children = (route.children ?? []).map((child) => (child.index ? { ...child, element: <AlwaysFails /> } : child))
        return { ...route, children }
      }
      return route.children ? { ...route, children: route.children.map(replaceDashboard) } : route
    }
    const tree = routes.map(replaceDashboard)
    renderAt('/', tree)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).toBeNull() // pointless on the Dashboard itself
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getAllByRole('link', { name: 'Nutrition' })[0]!))
    expect(screen.getByRole('heading', { level: 1, name: 'Nutrition' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('"Try again" re-renders the page in place', () => {
    renderAt('/crash', withTestRoutes([{ path: 'crash', element: <CrashingPage /> }]))
    pageShouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('heading', { name: 'Recovered page' })).toBeTruthy()
  })

  it('moves focus to the fallback so keyboard and screen-reader users notice it', () => {
    renderAt('/crash', withTestRoutes([{ path: 'crash', element: <CrashingPage /> }]))
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })

  it('public pages (login) are isolated the same way', () => {
    const tree = routes.map((route) =>
      route.path === undefined ? addChildren(route, [{ path: 'public-crash', element: <CrashingPage /> }]) : route,
    )
    renderAt('/public-crash', tree)
    expect(screen.getByRole('alert', { name: 'This page couldn’t be displayed' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Fitness AI — go to Dashboard' })).toBeTruthy() // public header intact
  })

  it('a crashing layout falls back to the app error page instead of the router default', () => {
    const tree = withTestRoutes([], [
      { path: '/broken-layout', element: <CrashingLayout />, errorElement: routes[1]!.errorElement },
    ])
    renderAt('/broken-layout', tree)
    expect(screen.getByRole('alert', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('Unexpected Application Error')
  })

  it('production build: route fallbacks show no technical details', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('PROD', true)
    try {
      renderAt('/crash', withTestRoutes([{ path: 'crash', element: <CrashingPage /> }]))
      expect(document.body.textContent).not.toContain('secret-internal-detail')
      expect(document.querySelector('details')).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('every real route still renders inside its layout', async () => {
    const router = renderAt('/', routes)
    const expectations: [string, string][] = [
      ['/', 'Dashboard'],
      ['/workouts', 'Workouts'],
      ['/nutrition', 'Nutrition'],
      ['/ai-coach', 'AI Coach'],
      ['/progress', 'Progress'],
      ['/profile', 'Profile'],
      ['/settings', 'Settings'],
      // /login and /register redirect signed-in users; covered in navigation and auth tests.
      ['/does-not-exist', 'Page not found'],
    ]
    for (const [path, heading] of expectations) {
      await act(async () => {
        await router.navigate(path)
      })
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    }
  })
})

describe('App', () => {
  it('renders the full app (providers, top-level boundary, router) for a signed-in user', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ user: { id: '1', email: 'alex@example.com', name: 'Alex', createdAt: '2026-11-20T10:00:00.000Z' } }),
      ),
    )
    try {
      render(<App />)
      expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })
})
