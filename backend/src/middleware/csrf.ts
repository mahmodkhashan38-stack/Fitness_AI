import type { RequestHandler } from 'express'
import { sendError } from './error-handler.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence in depth for cookie-authenticated requests (the session cookie is also
 * SameSite=Strict, which already stops cross-site browsers from sending it):
 *
 * 1. State-changing requests must come from an allowed app origin (Origin header), or, when a
 *    browser omits Origin, be same-origin per Sec-Fetch-Site. Requests with neither are refused.
 * 2. Request bodies must be JSON. HTML forms can't send application/json, and cross-origin
 *    scripts can't either without a CORS preflight, which only allowed origins pass.
 *
 * CORS is not relied on for this: it only controls which origins may *read* responses.
 */
export function csrfProtection(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins)

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next()

    const origin = req.get('origin')
    const fetchSite = req.get('sec-fetch-site')
    const trustedOrigin = origin !== undefined ? allowed.has(origin) : fetchSite === 'same-origin'
    if (!trustedOrigin) {
      return sendError(res, 403, 'CSRF_REJECTED', 'This request was blocked for security reasons. Reload the page and try again.')
    }

    const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding') !== undefined
    if (hasBody && !req.is('application/json')) {
      return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Request body must be JSON.')
    }
    next()
  }
}
