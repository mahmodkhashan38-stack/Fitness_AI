import type { HttpMethod } from '@/services/api/types'

/**
 * - `http`: the server answered with a non-2xx status (see `status` and `body`).
 * - `network`: no response (offline, DNS, CORS, connection reset).
 * - `timeout`: the client's timeout elapsed.
 * - `aborted`: the caller cancelled via its AbortSignal (usually not an error to show).
 * - `parse`: the response could not be read as the expected data (malformed JSON,
 *   wrong content type, or a `parse` validator rejected it).
 * - `config`: missing/invalid API base URL or an invalid request path.
 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'parse' | 'config'

interface ApiErrorDetails {
  kind: ApiErrorKind
  message: string
  method?: HttpMethod
  /** Request path without the query string, so query values are never echoed. */
  path?: string
  status?: number
  /** Parsed JSON or text of an error response (HTTP errors only). */
  body?: unknown
  /** Seconds the server asked the client to wait (Retry-After header, HTTP errors only). */
  retryAfterSeconds?: number
  cause?: unknown
}

/**
 * The single error type thrown by the API client.
 * Messages contain only method, path and status: never headers, query values or request bodies.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly method?: HttpMethod
  readonly path?: string
  readonly status?: number
  readonly body?: unknown
  readonly retryAfterSeconds?: number

  constructor({ kind, message, method, path, status, body, retryAfterSeconds, cause }: ApiErrorDetails) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiError'
    this.kind = kind
    this.method = method
    this.path = path
    this.status = status
    this.body = body
    this.retryAfterSeconds = retryAfterSeconds
  }

  /** 4xx: a problem with the request (validation, auth, not found). */
  get isClientError(): boolean {
    return this.kind === 'http' && this.status !== undefined && this.status >= 400 && this.status < 500
  }

  /** 5xx: a problem on the server. */
  get isServerError(): boolean {
    return this.kind === 'http' && this.status !== undefined && this.status >= 500
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
