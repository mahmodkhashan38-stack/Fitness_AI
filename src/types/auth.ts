import type { FitnessProfileField, FitnessProfileInput } from '@/types/fitness-profile'

/** The signed-in user as returned by the API (GET /api/auth/me). Never contains secrets. */
export interface AuthUser {
  id: string
  email: string
  name: string
  /** ISO 8601 instant. */
  createdAt: string
  /**
   * False for accounts created before FIT-12 that have no fitness profile yet: the app sends
   * them to onboarding before any fitness feature.
   */
  onboardingCompleted: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegistrationData extends LoginCredentials {
  name: string
  /** Mandatory: an account is only created together with its fitness profile. */
  profile: FitnessProfileInput
}

/**
 * - `loading`: checking the session (first load).
 * - `authenticated` / `unauthenticated`: the server answered.
 * - `unavailable`: the server couldn't be reached (offline, cold start, outage). The session
 *   may still be valid, so the user is NOT treated as logged out.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable'

export type AuthField = 'email' | 'password' | 'name'

/** Every field of the registration wizard (account details and fitness profile). */
export type RegistrationField = AuthField | FitnessProfileField

/** UI-ready error for the login, registration and profile forms. */
export interface AuthFormError<F extends string = AuthField> {
  /** Message for the whole form, or null when only fields are affected. */
  message: string | null
  fields: Partial<Record<F, string>>
}
