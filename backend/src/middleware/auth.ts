import type { RequestHandler, Response } from 'express'
import { readSessionCookie } from '../auth/cookies.js'
import type { DatabaseStatus } from '../database/connection.js'
import { findSessionUser, type AuthenticatedSession } from '../services/auth-service.js'
import { HttpError } from '../utils/http-error.js'

/**
 * Auth and user routes need MongoDB. While it is (re)connecting, e.g. right after a Render
 * cold start, answer quickly with 503 + Retry-After instead of letting queries hang.
 */
export function requireDatabase(getDatabaseStatus: () => DatabaseStatus): RequestHandler {
  return (_req, _res, next) => {
    if (getDatabaseStatus() === 'connected') return next()
    next(new HttpError(503, 'SERVICE_UNAVAILABLE', 'Fitness AI is starting up. Please try again in a moment.', { retryAfterSeconds: 5 }))
  }
}

/** Rejects the request with 401 unless it carries a valid session; exposes the session as res.locals.auth. */
export function requireAuth(secureCookies: boolean): RequestHandler {
  return async (req, res, next) => {
    const session = await findSessionUser(readSessionCookie(req, secureCookies))
    if (!session) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.'))
    res.locals.auth = session
    next()
  }
}

export function authenticated(res: Response): AuthenticatedSession {
  const auth = res.locals.auth as AuthenticatedSession | undefined
  if (!auth) throw new Error('requireAuth must run before this handler')
  return auth
}
