/** The signed-in user as returned by the API (GET /api/auth/me). Never contains secrets. */
export interface AuthUser {
  id: string
  email: string
  name: string
  /** ISO 8601 instant. */
  createdAt: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegistrationData extends LoginCredentials {
  name: string
}

/**
 * - `loading`: checking the session (first load).
 * - `authenticated` / `unauthenticated`: the server answered.
 * - `unavailable`: the server couldn't be reached (offline, cold start, outage). The session
 *   may still be valid, so the user is NOT treated as logged out.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable'

export type AuthField = 'email' | 'password' | 'name'

/** UI-ready error for the login and registration forms. */
export interface AuthFormError {
  /** Message for the whole form, or null when only fields are affected. */
  message: string | null
  fields: Partial<Record<AuthField, string>>
}
