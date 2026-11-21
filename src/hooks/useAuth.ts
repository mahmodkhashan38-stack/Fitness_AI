import type { AuthStatus, AuthUser, LoginCredentials, RegistrationData } from '@/types/auth'
import type { FitnessProfileInput } from '@/types/fitness-profile'
import { createStrictContext } from '@/utils/create-strict-context'

/** The session check failed temporarily: neither signed in nor signed out. */
export interface SessionUnavailability {
  /** `rate-limited`: HTTP 429. `unreachable`: offline, timeout, 5xx or upstream unavailable. */
  reason: 'rate-limited' | 'unreachable'
  /**
   * Earliest time (epoch ms) the server allows another check (its Retry-After), or null when it
   * set none (e.g. offline): automatic, online/foreground and manual retries wait until then.
   */
  notBefore: number | null
}

export interface AuthContextValue {
  status: AuthStatus
  /** Set only when status is `authenticated`. */
  user: AuthUser | null
  /** Why and until when the session can't be verified (status `unavailable` only), else null. */
  unavailable: SessionUnavailability | null
  /** True while a session check has been running for a few seconds (e.g. server cold start). */
  slow: boolean
  /** Throws ApiError on failure (map with toAuthFormError). */
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  register: (data: RegistrationData) => Promise<AuthUser>
  /**
   * Saves the fitness profile of an account created before FIT-12 and marks onboarding as
   * complete. Also resolves if the server says it was already completed (e.g. in another tab).
   * Throws ApiError otherwise (map with toFitnessProfileFormError).
   */
  completeOnboarding: (profile: FitnessProfileInput) => Promise<void>
  /** Ends the server-side session. Throws ApiError if the server can't be reached. */
  logout: () => Promise<void>
  /** Checks the session again now (e.g. a Retry button). */
  refresh: () => void
}

/** Context and hook live in the shared hooks layer; the provider is in app/providers/AuthProvider. */
const [AuthContext, useAuthContext] = createStrictContext<AuthContextValue>('Auth')

export { AuthContext }

export function useAuth(): AuthContextValue {
  return useAuthContext()
}
