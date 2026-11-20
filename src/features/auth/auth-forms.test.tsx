import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

describe('RegisterForm (multi-step registration with onboarding)', () => {
  const next = () => act(async () => screen.getByRole('button', { name: 'Next' }).click())
  const back = () => act(async () => screen.getByRole('button', { name: 'Back' }).click())
  const choose = (group: RegExp, option: string) =>
    act(async () => within(screen.getByRole('group', { name: group })).getByRole('radio', { name: option }).click())
  const heading = () => screen.getByRole('heading', { level: 2 })
  const progress = () => screen.getByRole('progressbar').getAttribute('aria-valuetext')

  async function fillAccount(name = 'Alex', email = 'alex@example.com', password = 'correct horse battery staple') {
    type('Name', name)
    type('Email', email)
    type('Password', password)
    await next()
  }
  async function fillBody({ age = '29', height = '175,5', weight = '72.4' } = {}) {
    await choose(/^Sex/, 'Female')
    type('Age', age)
    type('Height', height)
    type('Weight', weight)
    await next()
  }
  async function fillGoals() {
    await choose(/^Main goal/, 'Muscle Gain')
    await choose(/^Training days per week/, '4')
    await next()
  }

  it('starts with the account step and shows progress', () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    expect(progress()).toBe('Step 1 of 4: Account')
    expect(screen.getByText('Account').closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(heading().textContent).toBe('Your account')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('checks every account field like the server does before moving on (FIT-11 rules)', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    renderForm('register', auth)
    type('Email', 'not-an-email')
    type('Password', 'short')
    await next()
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Name'))
    expect(progress()).toBe('Step 1 of 4: Account')
    expect(auth.register).not.toHaveBeenCalled()
  })

  it('rejects using the email address as the password', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount('Alex', 'alex@example.com', 'Alex@Example.com')
    expect(screen.getByText('Your password can’t be your email address.')).toBeTruthy()
  })

  it('uses new-password autocomplete and explains the password rule', () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    expect(field('Password').autocomplete).toBe('new-password')
    expect(screen.getByText(/At least 12 characters/)).toBeTruthy()
  })

  it('moves focus to the new step heading and shows units and numeric keypads', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    expect(progress()).toBe('Step 2 of 4: Body')
    expect(document.activeElement).toBe(heading())
    expect(heading().textContent).toBe('About you')
    expect(field('Age').inputMode).toBe('numeric')
    expect(field('Height').inputMode).toBe('decimal')
    expect(field('Weight').inputMode).toBe('decimal')
    expect(screen.getByText('cm')).toBeTruthy()
    expect(screen.getByText('kg')).toBeTruthy()
  })

  it('requires every body field and focuses the first problem', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    await next()
    expect(screen.getByText('Select your sex.')).toBeTruthy()
    expect(screen.getByText('Enter your age.')).toBeTruthy()
    expect(screen.getByText('Enter your height in centimeters.')).toBeTruthy()
    expect(screen.getByText('Enter your weight in kilograms.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Male' }))
    expect(screen.getByRole('group', { name: /^Sex/ }).getAttribute('aria-invalid')).toBe('true')
    expect(progress()).toBe('Step 2 of 4: Body')
  })

  it.each([
    [{ age: '15' }, 'Age must be between 16 and 100.'],
    [{ age: '29.5' }, 'Enter your age in whole years.'],
    [{ age: 'abc' }, 'Enter your age.'],
    [{ height: '99' }, 'Height must be between 100 and 250 cm.'],
    [{ height: '1.80' }, 'Height must be between 100 and 250 cm.'],
    [{ weight: '301' }, 'Weight must be between 30 and 300 kg.'],
    [{ weight: '-70' }, 'Enter your weight in kilograms.'],
  ])('explains invalid body values %j', async (values, message) => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    await fillBody(values)
    expect(screen.getByText(message)).toBeTruthy()
    expect(progress()).toBe('Step 2 of 4: Body')
  })

  it('clears a field error as soon as the field is edited', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    await fillBody({ age: '12' })
    expect(field('Age').getAttribute('aria-invalid')).toBe('true')
    type('Age', '30')
    expect(field('Age').getAttribute('aria-invalid')).toBeNull()
  })

  it('requires a goal and training days', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    await fillBody()
    await next()
    expect(screen.getByText('Choose your main goal.')).toBeTruthy()
    expect(screen.getByText('Choose how many days a week you train.')).toBeTruthy()
    expect(progress()).toBe('Step 3 of 4: Goals')
  })

  it('offers 0 to 7 training days and all four goals', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    await fillBody()
    const days = within(screen.getByRole('group', { name: /^Training days per week/ })).getAllByRole('radio')
    expect(days.map((radio) => (radio as HTMLInputElement).value)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
    const goals = within(screen.getByRole('group', { name: /^Main goal/ })).getAllByRole('radio')
    expect(goals.map((radio) => radio.getAttribute('aria-labelledby') && document.getElementById(radio.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Muscle Gain',
      'Fat Loss',
      'Maintenance',
      'General Fitness / Endurance',
    ])
  })

  it('keeps every value when going back and forward', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount('Alex', 'alex@example.com')
    await fillBody({ age: '41' })
    await choose(/^Main goal/, 'Fat Loss')
    await back()
    expect(field('Age').value).toBe('41')
    expect((screen.getByRole('radio', { name: 'Female' }) as HTMLInputElement).checked).toBe(true)
    await back()
    expect(field('Name').value).toBe('Alex')
    expect(field('Email').value).toBe('alex@example.com')
    expect(field('Password').value).toBe('correct horse battery staple')
    await next()
    await next()
    expect((screen.getByRole('radio', { name: 'Fat Loss' }) as HTMLInputElement).checked).toBe(true)
  })

  it('pressing Enter in a field moves to the next step instead of creating the account', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    renderForm('register', auth)
    type('Name', 'Alex')
    type('Email', 'alex@example.com')
    type('Password', 'correct horse battery staple')
    await act(async () => fireEvent.submit(field('Password').form!))
    expect(progress()).toBe('Step 2 of 4: Body')
    expect(auth.register).not.toHaveBeenCalled()
  })

  it('reviews everything, creates the account only on the final submit and signs in', async () => {
    const auth = createAuthValue({ status: 'unauthenticated' })
    const router = renderForm('register', auth, '/register?redirect=%2Fworkouts')
    await fillAccount('  Alex ')
    await fillBody()
    await fillGoals()

    expect(progress()).toBe('Step 4 of 4: Review')
    const review = screen.getByRole('heading', { level: 2 }).closest('form')!
    for (const text of ['Alex', 'alex@example.com', 'Female', '29 years', '175.5 cm', '72.4 kg', 'Muscle Gain', '4 days']) {
      expect(within(review).getByText(text)).toBeTruthy()
    }
    expect(within(review).queryByText('correct horse battery staple')).toBeNull()
    expect(auth.register).not.toHaveBeenCalled()

    await submit('Create account')
    expect(auth.register).toHaveBeenCalledTimes(1)
    expect(auth.register).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'alex@example.com',
      password: 'correct horse battery staple',
      profile: { sex: 'female', age: 29, heightCm: 175.5, weightKg: 72.4, goal: 'muscle_gain', trainingDaysPerWeek: 4 },
    })
    expect(router.state.location.pathname).toBe('/workouts')
  })

  it('Edit on the review step returns to that step', async () => {
    renderForm('register', createAuthValue({ status: 'unauthenticated' }))
    await fillAccount()
    await fillBody()
    await fillGoals()
    await act(async () => screen.getByRole('button', { name: 'Edit body' }).click())
    expect(progress()).toBe('Step 2 of 4: Body')
    expect(field('Weight').value).toBe('72.4')
  })

  it('returns to the account step when the email is already registered, offering login', async () => {
    const auth = createAuthValue({
      status: 'unauthenticated',
      register: vi.fn(async () => Promise.reject(httpError(409, { error: { code: 'EMAIL_TAKEN' } }))),
    })
    renderForm('register', auth, '/register?redirect=%2Fworkouts')
    await fillAccount()
    await fillBody()
    await fillGoals()
    await submit('Create account')
    expect(progress()).toBe('Step 1 of 4: Account')
    expect(field('Email').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(field('Email'))
    expect(screen.getByRole('link', { name: 'Go to log in' }).getAttribute('href')).toBe('/login?redirect=%2Fworkouts')
    expect(field('Password').value).toBe('correct horse battery staple')
  })

  it('shows a server field error on the step that contains the field', async () => {
    const auth = createAuthValue({
      status: 'unauthenticated',
      register: vi.fn(async () =>
        Promise.reject(httpError(400, { error: { code: 'VALIDATION_FAILED', fields: { weightKg: 'Weight must be between 30 and 300 kg.' } } })),
      ),
    })
    renderForm('register', auth)
    await fillAccount()
    await fillBody()
    await fillGoals()
    await submit('Create account')
    expect(progress()).toBe('Step 2 of 4: Body')
    expect(screen.getByText('Weight must be between 30 and 300 kg.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Weight'))
  })

  it('shows server account errors and clears them when the field is edited', async () => {
    const auth = createAuthValue({
      status: 'unauthenticated',
      register: vi.fn(async () =>
        Promise.reject(httpError(400, { error: { code: 'VALIDATION_FAILED', fields: { name: 'Remove unsupported characters.' } } })),
      ),
    })
    renderForm('register', auth)
    await fillAccount()
    await fillBody()
    await fillGoals()
    await submit('Create account')
    expect(screen.getByText('Remove unsupported characters.')).toBeTruthy()
    type('Name', 'Alex B')
    expect(screen.queryByText('Remove unsupported characters.')).toBeNull()
  })

  it('stays on the review step with a message when the server can’t be reached', async () => {
    const auth = createAuthValue({ status: 'unauthenticated', register: vi.fn(async () => Promise.reject(new ApiError({ kind: 'network', message: 'x' }))) })
    renderForm('register', auth)
    await fillAccount()
    await fillBody()
    await fillGoals()
    await submit('Create account')
    expect(screen.getByRole('alert').textContent).toMatch(/Can’t reach Fitness AI/)
    expect(progress()).toBe('Step 4 of 4: Review')
  })

  it('shows progress, blocks double submits and Back while creating the account', async () => {
    let resolve: (user: typeof TEST_USER) => void = () => {}
    const register = vi.fn(() => new Promise<typeof TEST_USER>((r) => (resolve = r)))
    renderForm('register', createAuthValue({ status: 'unauthenticated', register }))
    await fillAccount()
    await fillBody()
    await fillGoals()
    const form = screen.getByRole('button', { name: 'Create account' }).closest('form')!
    await submit('Create account')
    const button = screen.getByRole('button', { name: /Creating account/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () => button.click())
    await act(async () => fireEvent.submit(form))
    expect(register).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => resolve(TEST_USER))
  })
})
