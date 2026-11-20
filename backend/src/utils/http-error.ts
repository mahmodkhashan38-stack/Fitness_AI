/** An error whose status, code and message are safe to return to API clients. */
export class HttpError extends Error {
  readonly status: number
  readonly code: string
  /** Per-field validation messages (safe to show), e.g. { email: 'Enter a valid email address.' }. */
  readonly fields?: Readonly<Record<string, string>>
  /** Seconds the client should wait before retrying (sent as Retry-After). */
  readonly retryAfterSeconds?: number

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { cause?: unknown; fields?: Record<string, string>; retryAfterSeconds?: number },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.fields = options?.fields
    this.retryAfterSeconds = options?.retryAfterSeconds
  }
}

/** JSON error body used by every error response. */
export interface ErrorResponseBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
    requestId?: string
  }
}
