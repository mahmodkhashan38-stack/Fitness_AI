import type { ErrorRequestHandler, RequestHandler, Response } from 'express'
import { HttpError, type ErrorResponseBody } from '../utils/http-error.js'
import type { Logger } from '../utils/logger.js'

function send(res: Response, status: number, code: string, message: string) {
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined
  const body: ErrorResponseBody = { error: { code, message, ...(requestId ? { requestId } : {}) } }
  res.status(status).json(body)
}

/** Errors raised by express.json() carry a `type` and `status`. */
interface BodyParserError {
  type: string
  status: number
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as BodyParserError).type === 'string' &&
    typeof (error as BodyParserError).status === 'number'
  )
}

/** 404 for any route that wasn't matched. Does not echo the requested path. */
export const notFound: RequestHandler = (_req, res) => {
  send(res, 404, 'NOT_FOUND', 'The requested resource was not found.')
}

/**
 * Converts any error into the standard JSON error body.
 * Responses never contain stack traces or internal messages; unexpected errors are logged (redacted).
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }

    if (error instanceof HttpError) {
      send(res, error.status, error.code, error.message)
      return
    }

    if (isBodyParserError(error)) {
      if (error.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
      if (error.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON.')
      if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
        return send(res, 415, 'UNSUPPORTED_ENCODING', 'Request body encoding is not supported.')
      }
      if (error.status >= 400 && error.status < 500) return send(res, error.status, 'BAD_REQUEST', 'The request is invalid.')
    }

    logger.error('Unhandled error', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path, // no query string: it may contain personal data
      error,
    })
    send(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.')
  }
}
