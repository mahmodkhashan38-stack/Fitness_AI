import { HttpError } from './http-error.js'

/** 400 VALIDATION_FAILED with per-field messages (safe to show; they never echo the submitted value). */
export function validationError(fields: Record<string, string>): HttpError {
  return new HttpError(400, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', { fields })
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The body (or a nested object) must be a plain JSON object containing only the allowed keys.
 * Unknown keys, e.g. "id", "userId" or "role", are rejected instead of silently ignored.
 */
export function readObject(body: unknown, allowed: readonly string[], what = 'Request body'): Record<string, unknown> {
  if (!isPlainObject(body)) throw new HttpError(400, 'VALIDATION_FAILED', `${what} must be a JSON object.`)
  const unknownKeys = Object.keys(body).filter((key) => !allowed.includes(key))
  if (unknownKeys.length > 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', `Unexpected field: ${unknownKeys[0]!.slice(0, 40)}.`)
  }
  return body
}
