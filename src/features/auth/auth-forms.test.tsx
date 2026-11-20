import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginForm from '@/features/auth/LoginForm'
import RegisterForm from '@/features/auth/RegisterForm'
import type { AuthContextValue } from '@/hooks/useAuth'
import { ApiError } from '@/services/api/errors'
import { createAuthValue, TEST_USER, TestAuthProvider } from '@/test/auth'

function renderForm(form: 'login' | 'register', auth: AuthContextValue, path = `/${form}`) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginForm /> },
      { path: '/register', element: <RegisterForm /> },
      { path: '/', element: <h1>Dashboard</h1> },
      { path: '/workouts', element: <h1>Workouts</h1> },
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

const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const submit = (name: string) => act(async () => screen.getByRole('button', { name }).click())
const httpError = (status: number, body: unknown) => new ApiError({ kind: 'http', status, body, message: 'x' })

afterEach(() => {
  vi.useRealTimers()
})

describe('LoginForm', () => {
  it('validates required fields locally and focuses the first problem', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    renderForm('login', auth)
    await submit('Log in')
    expect(screen.getByText('Enter your email address.')).toBeTruthy()
    expect(screen.getByText('Enter your password.')).toBeTruthy()
    expect(field('Email').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(field('Email'))
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('uses browser-friendly autocomplete attributes', () => {
    renderForm('login', createAuthValue({ status: 'unauthenticated' }))
    expect(field('Email').autocomplete).toBe('email')
    expect(field('Password').autocomplete).toBe('current-password')
    expect(field('Password').type).toBe('password')
  })

  it('logs in with a trimmed email and goes to the redirect target', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    const router = renderForm('login', auth, '/login?redirect=%2Fworkouts')
    type('Email', '  alex@example.com ')
    type('Password', 'correct horse battery staple')
    await submit('Log in')
    expect(auth.login).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'correct horse battery staple' })
    expect(router.state.location.pathname).toBe('/workouts')
  })

  it('goes to the dashboard when the redirect is unsafe', async () => {
    const router = renderForm('login', createAuthValue({ status: 'unauthenticated' }), '/login?redirect=https%3A%2F%2Fevil.example.com')
    type('Email', 'alex@example.com')
    type('Password', 'correct horse battery staple')
    await submit('Log in')
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows the generic message for wrong credentials and stays on the page', async () => {
    const auth = createAuthValue({
      status: 'unauthenticated',
      login: vi.fn(async () => Promise.reject(httpError(401, { error: { code: 'INVALID_CREDENTIALS' } }))),
    })
    const router = renderForm('login', auth)
    type('Email', 'alex@example.com')
    type('Password', 'wrong password!')
    await submit('Log in')
    expect(screen.getByRole('alert').textContent).toContain('Email or password is incorrect.')
    expect(router.state.location.pathname).toBe('/login')
  })

  it('explains rate limiting and network failures', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, { error: { code: 'RATE_LIMITED' } }))
      .mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'x' }))
    renderForm('login', createAuthValue({ status: 'unauthenticated', login }))
    type('Email', 'alex@example.com')
    type('Password', 'whatever whatever')
    await submit('Log in')
    expect(screen.getByRole('alert').textContent).toMatch(/Too many attempts/)
    await submit('Log in')
    expect(screen.getByRole('alert').textContent).toMatch(/Can’t reach Fitness AI/)
  })

  it('shows progress, blocks double submits and mentions a slow server', async () => {
    vi.useFakeTimers()
    let resolve: (user: typeof TEST_USER) => void = () => {}
    const login = vi.fn(() => new Promise<typeof TEST_USER>((r) => (resolve = r)))
    renderForm('login', createAuthValue({ status: 'unauthenticated', login }))
    type('Email', 'alex@example.com')
    type('Password', 'correct horse battery staple')
    await submit('Log in')
    const button = screen.getByRole('button', { name: /Logging in/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () => button.click())
    expect(login).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(4_000))
    expect(screen.getByText(/Waking up Fitness AI/)).toBeTruthy()
    await act(async () => resolve(TEST_USER))
  })
})

describe('RegisterForm', () => {
  it('checks every field like the server does', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    renderForm('register', auth)
    type('Email', 'not-an-email')
    type('Password', 'short')
    await submit('Create account')
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Name'))
    expect(auth.register).not.toHaveBeenCalled()
  })

  it('rejects using the email address as the password', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    type('Name', 'Alex')
    type('Email', 'alex@example.com')
    type('Password', 'Alex@Example.com')
    await submit('Create account')
    expect(screen.getByText('Your password can’t be your email address.')).toBeTruthy()
  })

  it('creates the account and signs in', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    const router = renderForm('register', auth)
    type('Name', '  Alex ')
    type('Email', 'alex@example.com')
    type('Password', 'correct horse battery staple')
    await submit('Create account')
    expect(auth.register).toHaveBeenCalledWith({ name: 'Alex', email: 'alex@example.com', password: 'correct horse battery staple' })
    expect(router.state.location.pathname).toBe('/')
  })

  it('offers login when the email is already registered', async () => {
    const auth = createAuthValue({
      status: 'unauthenticated',
      register: vi.fn(async () => Promise.reject(httpError(409, { error: { code: 'EMAIL_TAKEN' } }))),
    })
    renderForm('register', auth, '/register?redirect=%2Fworkouts')
    type('Name', 'Alex')
    type('Email', 'alex@example.com')
    type('Password', 'correct horse battery staple')
    await submit('Create account')
    expect(field('Email').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('link', { name: 'Go to log in' }).getAttribute('href')).toBe('/login?redirect=%2Fworkouts')
  })

  it('shows server field errors and clears them when the field is edited', async () => {
    const auth = createAuthValue({
      status: 'unauthenticated',
      register: vi.fn(async () =>
        Promise.reject(httpError(400, { error: { code: 'VALIDATION_FAILED', fields: { name: 'Remove unsupported characters.' } } })),
      ),
    })
    renderForm('register', auth)
    type('Name', 'Alex')
    type('Email', 'alex@example.com')
    type('Password', 'correct horse battery staple')
    await submit('Create account')
    expect(screen.getByText('Remove unsupported characters.')).toBeTruthy()
    type('Name', 'Alex B')
    expect(screen.queryByText('Remove unsupported characters.')).toBeNull()
  })

  it('uses new-password autocomplete and explains the password rule', () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    expect(field('Password').autocomplete).toBe('new-password')
    expect(screen.getByText(/At least 12 characters/)).toBeTruthy()
  })
})
