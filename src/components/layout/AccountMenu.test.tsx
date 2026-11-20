import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountMenu from '@/components/layout/AccountMenu'
import type { AuthContextValue } from '@/hooks/useAuth'
import { ThemeContext, type ThemeContextValue } from '@/hooks/useTheme'
import { createAuthValue, TestAuthProvider } from '@/test/auth'

const theme: ThemeContextValue = {
  preference: 'system',
  resolvedTheme: 'light',
  setPreference: vi.fn(),
  toggleTheme: vi.fn(),
}

function renderMenu(auth: AuthContextValue = createAuthValue()) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <AccountMenu /> },
      { path: '/profile', element: <p>Profile page</p> },
      { path: '/settings', element: <p>Settings page</p> },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <ThemeContext.Provider value={theme}>
      <TestAuthProvider value={auth}>
        <RouterProvider router={router} />
      </TestAuthProvider>
    </ThemeContext.Provider>,
  )
  return router
}

const button = () => screen.getByRole('button', { name: 'Account menu for Alex Carter' })
const panel = () => document.getElementById(button().getAttribute('aria-controls') ?? button().getAttribute('popovertarget')!)!

describe('AccountMenu without the Popover API (fallback: Safari < 17, Firefox < 125, Chrome < 114)', () => {
  it('starts closed and hidden, with disclosure semantics', () => {
    renderMenu()
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(panel().hidden).toBe(true)
    expect(panel().hasAttribute('popover')).toBe(false)
  })

  it('toggles open and closed with the button', () => {
    renderMenu()
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(panel().hidden).toBe(false)
    expect(panel().hasAttribute('data-fallback-open')).toBe(true)
    fireEvent.click(button())
    expect(panel().hidden).toBe(true)
  })

  it('Escape closes it and returns focus to the button', () => {
    renderMenu()
    fireEvent.click(button())
    const profile = screen.getByRole('link', { name: 'Profile' })
    profile.focus()
    fireEvent.keyDown(profile, { key: 'Escape' })
    expect(panel().hidden).toBe(true)
    expect(document.activeElement).toBe(button())
  })

  it('Escape also closes it when focus is still on the button (parity with native popover)', () => {
    renderMenu()
    button().focus()
    fireEvent.click(button())
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(panel().hidden).toBe(true)
    expect(document.activeElement).toBe(button())
  })

  it('a click outside closes it; a click inside does not', () => {
    renderMenu()
    fireEvent.click(button())
    fireEvent.pointerDown(screen.getByRole('link', { name: 'Profile' }))
    expect(panel().hidden).toBe(false)
    fireEvent.pointerDown(document.body)
    expect(panel().hidden).toBe(true)
  })

  it('choosing Settings navigates and closes the menu (account pages reachable on mobile)', async () => {
    const router = renderMenu()
    fireEvent.click(button())
    await act(async () => fireEvent.click(screen.getByRole('link', { name: 'Settings' })))
    expect(router.state.location.pathname).toBe('/settings')
  })
})

describe('AccountMenu with the Popover API', () => {
  const proto = HTMLElement.prototype as HTMLElement & { showPopover?: () => void; hidePopover?: () => void }
  const original = { show: proto.showPopover, hide: proto.hidePopover }
  afterEach(() => {
    proto.showPopover = original.show
    proto.hidePopover = original.hide
  })

  it('uses popover="auto" with a popovertarget button, and hides it after navigating', async () => {
    proto.showPopover = vi.fn()
    proto.hidePopover = vi.fn()
    const router = renderMenu()
    expect(button().getAttribute('popovertarget')).toBe(panel().id)
    expect(panel().getAttribute('popover')).toBe('auto')
    expect(button().hasAttribute('aria-expanded')).toBe(false) // the browser manages it
    await act(async () => fireEvent.click(screen.getByRole('link', { name: 'Profile', hidden: true })))
    expect(proto.hidePopover).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/profile')
  })
})

describe('AccountMenu account details and logout', () => {
  it('shows the signed-in user’s name and email', () => {
    renderMenu()
    expect(screen.getByText('Alex Carter', { selector: 'span.truncate' })).toBeTruthy()
    expect(screen.getByText('alex@example.com')).toBeTruthy()
  })

  it('logs out on the server, then goes to the login page', async () => {
    const auth = createAuthValue()
    const router = renderMenu(auth)
    fireEvent.click(button())
    await act(async () => {
      screen.getByRole('button', { name: 'Log out' }).click()
    })
    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/login')
  })

  it('stays signed in and explains when logout fails (e.g. offline)', async () => {
    const auth = createAuthValue({ logout: vi.fn(async () => Promise.reject(new Error('offline'))) })
    const router = renderMenu(auth)
    fireEvent.click(button())
    await act(async () => {
      screen.getByRole('button', { name: 'Log out' }).click()
    })
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t log out/)
    expect((screen.getByRole('button', { name: 'Log out' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
