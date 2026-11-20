import type { AuthStatus, AuthUser, LoginCredentials, RegistrationData } from '@/types/auth'
import { createStrictContext } from '@/utils/create-strict-context'

export interface AuthContextValue {
  status: AuthStatus
  /** Set only when status is `authenticated`. */
  user: AuthUser | null
  /** True while a session check has been running for a few seconds (e.g. server cold start). */
  slow: boolean
  /** Throws ApiError on failure (map with toAuthFormError). */
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  register: (data: RegistrationData) => Promise<AuthUser>
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
