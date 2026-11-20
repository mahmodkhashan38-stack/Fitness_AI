/** An error whose status, code and message are safe to return to API clients. */
export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/** JSON error body used by every error response. */
export interface ErrorResponseBody {
  error: {
    code: string
    message: string
    requestId?: string
  }
}
