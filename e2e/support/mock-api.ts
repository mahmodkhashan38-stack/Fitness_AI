import type { Page, Route } from '@playwright/test'
import type { AuthUser } from '@/types/auth'
import type { FitnessProfile } from '@/types/fitness-profile'

/**
 * A stand-in for the API, so browser tests need no backend. Payloads use the app's own types, so
 * a contract change that the app adopts shows up here as a type error.
 *
 * Only read requests are answered. Any other API call fails the test (see `unexpected`): these
 * tests look at screens, they don't save anything.
 */
export interface MockAccount {
  user: AuthUser
  /** null: an account created before FIT-12 (no fitness profile; the app shows onboarding). */
  profile: FitnessProfile | null
}

const YEAR = new Date().getUTCFullYear()

/** The longest name the app accepts (60 characters), without spaces, and a long email address. */
export const LONG_NAME = 'Maximiliana-Alexandrovna-Konstantinopoulou-Featherstonehaugh'.slice(0, 60)
export const LONG_EMAIL = 'maximiliana.alexandrovna.konstantinopoulou@subdomain.example-company.com'

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: '64b7f0c2a1b2c3d4e5f60718',
  email: 'alex@example.com',
  name: 'Alex Rivera',
  createdAt: '2026-01-15T09:30:00.000Z',
  onboardingCompleted: true,
  ...overrides,
})

const profile = (overrides: Partial<FitnessProfile> = {}): FitnessProfile => ({
  sex: 'female',
  birthYear: YEAR - 29,
  age: 29,
  heightCm: 168,
  weightKg: 61.5,
  goal: 'muscle_gain',
  trainingDaysPerWeek: 4,
  onboardingCompleted: true,
  onboardingCompletedAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
})

export const ACCOUNTS = {
  /** A complete FIT-14 profile. */
  standard: { user: user(), profile: profile() },
  /** Long name and email, the widest content the header, profile and account card can get. */
  longDetails: { user: user({ name: LONG_NAME, email: LONG_EMAIL }), profile: profile() },
  /** Saved before FIT-14: an age as entered, no birth year (shows the "Add your birth year" prompt). */
  legacy: { user: user({ name: 'Omar Haddad', email: 'omar@example.com' }), profile: profile({ birthYear: null, age: 41, sex: 'male' }) },
  /** Created before FIT-12: no profile yet, with a long email (onboarding page). */
  onboarding: { user: user({ name: LONG_NAME, email: LONG_EMAIL, onboardingCompleted: false }), profile: null },
} satisfies Record<string, MockAccount>

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * Answers /api/* for `account` (null: signed out). Returns the API calls the mock didn't expect,
 * which a test should assert to be empty.
 */
export async function mockApi(page: Page, account: MockAccount | null): Promise<string[]> {
  const unexpected: string[] = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const call = `${request.method()} ${path}`
    if (call === 'GET /api/auth/me') {
      return account
        ? json(route, 200, { user: account.user })
        : json(route, 401, { error: { code: 'UNAUTHENTICATED', message: 'Log in to continue.' } })
    }
    if (call === 'GET /api/users/me/fitness-profile' && account) {
      return account.profile
        ? json(route, 200, { profile: account.profile })
        : json(route, 409, { error: { code: 'ONBOARDING_REQUIRED', message: 'Complete your fitness profile first.' } })
    }
    unexpected.push(call)
    return json(route, 500, { error: { code: 'INTERNAL_ERROR', message: `Not mocked: ${call}` } })
  })
  return unexpected
}
