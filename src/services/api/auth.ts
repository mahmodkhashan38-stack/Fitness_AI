import { apiClient } from '@/services/api/client'
import { isApiError } from '@/services/api/errors'
import type { ApiClient } from '@/services/api/types'
import type { AuthField, AuthFormError, AuthUser, LoginCredentials, RegistrationData } from '@/types/auth'

/**
 * Authentication endpoints. The session is an HttpOnly cookie handled entirely by the browser:
 * no token ever reaches JavaScript or storage. Requests are same-origin (/api via the Worker
 * in production, the Vite proxy in development), so `fetch` sends the cookie by default.
 */

/** Long enough for a Render free-tier cold start (~1 minute) instead of failing early. */
export const AUTH_REQUEST_TIMEOUT_MS = 70_000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseAuthUser(value: unknown): AuthUser {
  if (!isRecord(value)) throw new TypeError('Unexpected user payload')
  const { id, email, name, createdAt, onboardingCompleted } = value
  if (
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    typeof name !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof onboardingCompleted !== 'boolean'
  ) {
    throw new TypeError('Unexpected user payload')
  }
  return { id, email, name, createdAt, onboardingCompleted }
}

const parseUserResponse = (data: unknown): AuthUser => {
  if (!isRecord(data)) throw new TypeError('Unexpected response')
  return parseAuthUser(data.user)
}

/** The signed-in user, or null when there is no valid session (401). Other failures throw ApiError. */
export async function fetchCurrentUser(options: { signal?: AbortSignal; client?: ApiClient } = {}): Promise<AuthUser | null> {
  const client = options.client ?? apiClient
  try {
    return await client.get('/auth/me', { signal: options.signal, parse: parseUserResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
  } catch (error) {
    if (isApiError(error) && error.kind === 'http' && error.status === 401) return null
    throw error
  }
}

export function login(credentials: LoginCredentials, client: ApiClient = apiClient): Promise<AuthUser> {
  return client.post('/auth/login', { body: credentials, parse: parseUserResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
}

export function register(data: RegistrationData, client: ApiClient = apiClient): Promise<AuthUser> {
  return client.post('/auth/register', { body: data, parse: parseUserResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
}

/** Ends the session on the server (and clears the cookie). */
/** Changes the signed-in user's display name (PATCH /api/users/me; the API always uses the session's user). */
export function updateName(name: string, client: ApiClient = apiClient): Promise<AuthUser> {
  return client.patch('/users/me', { body: { name }, parse: parseUserResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
}

export async function logout(client: ApiClient = apiClient): Promise<void> {
  await client.post('/auth/logout', { timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
}

/** Network-level or server-side problems: worth retrying, and not a reason to log the user out. */
export function isTemporaryAuthFailure(error: unknown): boolean {
  if (!isApiError(error)) return false
  if (error.kind === 'network' || error.kind === 'timeout') return true
  return error.kind === 'http' && error.status !== undefined && error.status >= 500
}

export const AUTH_FIELDS: readonly AuthField[] = ['email', 'password', 'name']

/** The API's error code (e.g. "EMAIL_TAKEN"), if the error carries one. */
export function apiErrorCode(error: unknown): string | undefined {
  return isApiError(error) && error.kind === 'http' ? errorCode(error.body) : undefined
}

function errorCode(body: unknown): string | undefined {
  return isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string' ? body.error.code : undefined
}

/** Per-field messages from a validation error, limited to the fields the form knows. */
function errorFields<F extends string>(body: unknown, known: readonly F[]): AuthFormError<F>['fields'] {
  if (!isRecord(body) || !isRecord(body.error) || !isRecord(body.error.fields)) return {}
  const fields: AuthFormError<F>['fields'] = {}
  for (const field of known) {
    const message = body.error.fields[field]
    if (typeof message === 'string') fields[field] = message
  }
  return fields
}

/**
 * Maps any login/registration failure to fixed, user-friendly copy. Server messages are only
 * used for per-field validation; everything else uses local text, so nothing internal leaks.
 */
export function toAuthFormError<F extends string = AuthField>(
  error: unknown,
  knownFields: readonly F[] = AUTH_FIELDS as unknown as readonly F[],
): AuthFormError<F> | null {
  if (!isApiError(error)) return { message: 'Something went wrong. Please try again.', fields: {} }

  switch (error.kind) {
    case 'aborted':
      return null
    case 'network':
      return { message: 'Can’t reach Fitness AI. Check your connection and try again.', fields: {} }
    case 'timeout':
      return { message: 'Fitness AI is taking too long to respond. Please try again.', fields: {} }
    case 'http':
      break
    default:
      return { message: 'Something went wrong. Please try again.', fields: {} }
  }

  const fields = errorFields(error.body, knownFields)
  switch (errorCode(error.body)) {
    case 'VALIDATION_FAILED':
      return { message: Object.keys(fields).length ? null : 'Check your details and try again.', fields }
    case 'INVALID_CREDENTIALS':
      return { message: 'Email or password is incorrect.', fields: {} }
    case 'EMAIL_TAKEN':
      return {
        message: null,
        fields: { email: 'An account with this email already exists. Log in instead.' } as AuthFormError<F>['fields'],
      }
    case 'RATE_LIMITED':
      return { message: 'Too many attempts. Please wait a few minutes and try again.', fields: {} }
    case 'UNAUTHENTICATED':
      return { message: 'Your session has ended. Please log in again.', fields: {} }
    case 'CSRF_REJECTED':
      return { message: 'Your request was blocked for security reasons. Reload the page and try again.', fields: {} }
  }
  if (error.status !== undefined && error.status >= 500) {
    return { message: 'Fitness AI is starting up or temporarily unavailable. Please try again in a moment.', fields: {} }
  }
  return { message: 'Something went wrong. Please try again.', fields: {} }
}
