import { Router } from 'express'
import type { DatabaseStatus } from '../database/connection.js'
import { parseFitnessProfileUpdate, parseOnboarding } from '../fitness/validation.js'
import { authenticated, requireAuth, requireDatabase } from '../middleware/auth.js'
import { completeOnboarding, getFitnessProfile, updateFitnessProfile } from '../services/fitness-profile-service.js'
import { HttpError } from '../utils/http-error.js'

export interface FitnessProfileRouterOptions {
  secureCookies: boolean
  getDatabaseStatus: () => DatabaseStatus
}

/**
 * /api/users/me/fitness-profile: the signed-in user's own fitness profile. There is deliberately
 * no route with a user id: the owner is always the session's user. Global middleware (proxy gate,
 * rate limit, CSRF/JSON checks, no-store) applies as for every other API route.
 */
export function createFitnessProfileRouter({ secureCookies, getDatabaseStatus }: FitnessProfileRouterOptions): Router {
  const router = Router()
  const path = '/users/me/fitness-profile'
  router.use(path, requireDatabase(getDatabaseStatus), requireAuth(secureCookies))

  router.get(path, async (_req, res) => {
    const profile = await getFitnessProfile(authenticated(res).userId)
    if (!profile) throw new HttpError(404, 'FITNESS_PROFILE_NOT_FOUND', 'You haven’t set up your fitness profile yet.')
    res.json({ profile })
  })

  // Completes onboarding for accounts created before FIT-12 (new accounts get their profile at registration).
  router.post(path, async (req, res) => {
    const input = parseOnboarding(req.body)
    res.status(201).json({ profile: await completeOnboarding(authenticated(res).userId, input) })
  })

  router.patch(path, async (req, res) => {
    const update = parseFitnessProfileUpdate(req.body)
    res.json({ profile: await updateFitnessProfile(authenticated(res).userId, update) })
  })

  return router
}
