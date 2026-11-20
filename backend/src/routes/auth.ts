import { Router } from 'express'
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '../auth/cookies.js'
import { parseLogin, parseRegistration, parseProfileUpdate } from '../auth/validation.js'
import type { DatabaseStatus } from '../database/connection.js'
import { authenticated, requireAuth, requireDatabase } from '../middleware/auth.js'
import { createAuthRateLimiters, type AuthRateLimits } from '../middleware/rate-limit.js'
import { endSession, login, register, updateProfile } from '../services/auth-service.js'

export interface AuthRouterOptions {
  secureCookies: boolean
  getDatabaseStatus: () => DatabaseStatus
  rateLimits: AuthRateLimits
}

/**
 * /api/auth/* and /api/users/me. Express 5 forwards rejected promises from async handlers
 * to the error handler, so HttpErrors thrown below become JSON error responses.
 */
export function createAuthRouter({ secureCookies, getDatabaseStatus, rateLimits }: AuthRouterOptions): Router {
  const router = Router()
  const limiters = createAuthRateLimiters(rateLimits)
  const auth = requireAuth(secureCookies)

  router.use(['/auth', '/users'], requireDatabase(getDatabaseStatus))

  router.post('/auth/register', limiters.register, async (req, res) => {
    const input = parseRegistration(req.body)
    const { user, token } = await register(input, readSessionCookie(req, secureCookies))
    setSessionCookie(res, token, secureCookies)
    res.status(201).json({ user })
  })

  router.post('/auth/login', limiters.loginPerIp, limiters.loginPerEmail, async (req, res) => {
    const input = parseLogin(req.body)
    const { user, token } = await login(input, readSessionCookie(req, secureCookies))
    setSessionCookie(res, token, secureCookies)
    res.json({ user })
  })

  // Idempotent: always clears the cookie, and deletes the server-side session if there is one.
  router.post('/auth/logout', async (req, res) => {
    await endSession(readSessionCookie(req, secureCookies))
    clearSessionCookie(res, secureCookies)
    res.status(204).end()
  })

  router.get('/auth/me', auth, (_req, res) => {
    res.json({ user: authenticated(res).user })
  })

  router.patch('/users/me', auth, async (req, res) => {
    const input = parseProfileUpdate(req.body)
    res.json({ user: await updateProfile(authenticated(res).userId, input) })
  })

  return router
}
