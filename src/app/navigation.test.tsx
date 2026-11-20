/** Navigation behaviour of the real route tree (memory router, jsdom). */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import ThemeProvider from '@/app/providers/ThemeProvider'
import { routes } from '@/app/router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  return router
}

/** jsdom does not apply CSS, so both the sidebar and the bottom bar are in the DOM. */
const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' })
const bottomBar = () => screen.getAllByRole('navigation', { name: 'Primary' }).find((nav) => nav.closest('aside') === null)!
const activeIn = (container: HTMLElement) =>
  within(container)
    .queryAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent)

const APP_ROUTES: [string, string, string | null][] = [
  // path, page heading, active primary item (null = none)
  ['/', 'Dashboard', 'Dashboard'],
  ['/workouts', 'Workouts', 'Workouts'],
  ['/nutrition', 'Nutrition', 'Nutrition'],
  ['/progress', 'Progress', 'Progress'],
  ['/ai-coach', 'AI Coach', 'AI Coach'],
  ['/profile', 'Profile', null],
  ['/settings', 'Settings', null],
  ['/no-such-page', 'Page not found', null],
]

describe('navigation (real routes)', () => {
  it.each(APP_ROUTES)('direct navigation to %s: heading, tab title and active link', (path, heading, active) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    expect(document.title).toBe(`${heading} · Fitness AI`)
    expect(activeIn(bottomBar())).toEqual(active ? [active] : [])
    const sidebarActive = activeIn(sidebar())
    const expectedSidebar = active ?? (path === '/profile' ? 'Profile' : path === '/settings' ? 'Settings' : null)
    expect(sidebarActive).toEqual(expectedSidebar ? [expectedSidebar] : [])
  })

  it('Dashboard is active only on "/" (not on every page)', () => {
    renderAt('/workouts')
    expect(activeIn(sidebar())).not.toContain('Dashboard')
  })

  it('mobile bottom navigation order is Progress | Workouts | Dashboard | Nutrition | AI Coach', () => {
    renderAt('/')
    const labels = within(bottomBar())
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(labels).toEqual(['Progress', 'Workouts', 'Dashboard', 'Nutrition', 'AI Coach'])
  })

  it('account pages stay reachable without the sidebar (header account menu)', async () => {
    renderAt('/')
    // jsdom has no Popover API, so this exercises the fallback used by older browsers;
    // the native popover path is covered in a real browser and in AccountMenu.test.tsx.
    const menuButton = screen.getByRole('button', { name: /Account menu/ })
    fireEvent.click(menuButton)
    expect(menuButton.getAttribute('aria-expanded')).toBe('true')
    const menu = document.getElementById(menuButton.getAttribute('aria-controls')!)!
    const links = within(menu).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/profile', '/settings'])
    await act(async () => fireEvent.click(links[1]!))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
  })

  it('clicking navigation, then Back and Forward, restores page, title and active state', async () => {
    const router = renderAt('/')
    await act(async () => fireEvent.click(within(sidebar()).getByRole('link', { name: 'Nutrition' })))
    await act(async () => fireEvent.click(within(sidebar()).getByRole('link', { name: 'Progress' })))
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeTruthy()

    await act(async () => {
      await router.navigate(-1)
    })
    expect(router.state.location.pathname).toBe('/nutrition')
    expect(screen.getByRole('heading', { level: 1, name: 'Nutrition' })).toBeTruthy()
    expect(activeIn(sidebar())).toEqual(['Nutrition'])

    await act(async () => {
      await router.navigate(-1)
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()

    await act(async () => {
      await router.navigate(1)
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Nutrition' })).toBeTruthy()
    expect(document.title).toBe('Nutrition · Fitness AI')
  })

  it.each([
    ['/login', 'Log in'],
    ['/register', 'Create account'],
  ])('public route %s has no app navigation, header menu or sidebar', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('button', { name: /Account menu/ })).toBeNull()
  })

  it('public pages link to each other', async () => {
    renderAt('/login')
    await act(async () => fireEvent.click(screen.getByRole('link', { name: 'Create an account' })))
    expect(screen.getByRole('heading', { level: 1, name: 'Create account' })).toBeTruthy()
  })

  it('development build: the design system route is registered (production exclusion is checked on the build output)', async () => {
    renderAt('/design-system')
    expect(await screen.findByRole('heading', { level: 1, name: /Design System/ })).toBeTruthy()
  })
})
