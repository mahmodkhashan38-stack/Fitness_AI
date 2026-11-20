import { createHash, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import type { RequestHandler } from 'express'
import { sendError } from './error-handler.js'

/** Header carrying the shared secret, set by the Cloudflare Worker (worker/index.ts). */
export const PROXY_AUTH_HEADER = 'X-Fitness-Proxy-Auth'
/** Header carrying the visitor's IP, set by the Worker from CF-Connecting-IP. */
export const CLIENT_IP_HEADER = 'X-Fitness-Client-Ip'

const digest = (value: string) => createHash('sha256').update(value).digest()

/**
 * In production the API is only reachable through the Cloudflare Worker that serves the app
 * (same origin as the frontend, so the session cookie is first-party). The Worker proves itself
 * with a shared secret; direct calls to the Render URL are refused, except the health check
 * used by Render and monitoring.
 *
 * Also decides the client IP used for rate limiting (res.locals.clientIp): the Worker-supplied
 * address when the secret is valid, otherwise req.ip (governed by TRUST_PROXY_HOPS).
 */
export function proxyGate(proxySecret: string | undefined): RequestHandler {
  const expected = proxySecret ? digest(proxySecret) : undefined

  return (req, res, next) => {
    res.locals.clientIp = req.ip
    if (!expected) return next()

    const provided = req.get(PROXY_AUTH_HEADER)
    // Compare fixed-length digests in constant time.
    const authorised = provided !== undefined && timingSafeEqual(digest(provided), expected)

    if (authorised) {
      const forwarded = req.get(CLIENT_IP_HEADER)?.trim()
      if (forwarded && isIP(forwarded)) res.locals.clientIp = forwarded
      return next()
    }

    if (req.method === 'GET' && req.path === '/api/health') return next()
    sendError(res, 403, 'FORBIDDEN', 'This API is only available through the Fitness AI app.')
  }
}
