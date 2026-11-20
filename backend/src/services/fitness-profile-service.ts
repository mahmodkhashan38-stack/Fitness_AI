import type { Types } from 'mongoose'
import type { FitnessProfileInput } from '../fitness/validation.js'
import { FitnessProfileModel, toPublicFitnessProfile, type PublicFitnessProfile } from '../models/fitness-profile.js'
import { HttpError } from '../utils/http-error.js'
import { isDuplicateKeyError } from '../utils/mongo-errors.js'

/**
 * Fitness profile operations. Every function takes the user id from the authenticated session
 * (routes never read a user id from the request), and every query is filtered by it, so a user
 * can only ever read or change their own profile.
 */

export const ONBOARDING_REQUIRED = () =>
  new HttpError(409, 'ONBOARDING_REQUIRED', 'Complete your fitness profile first.')

export async function hasFitnessProfile(userId: Types.ObjectId): Promise<boolean> {
  return (await FitnessProfileModel.exists({ userId })) !== null
}

export async function getFitnessProfile(userId: Types.ObjectId): Promise<PublicFitnessProfile | null> {
  const profile = await FitnessProfileModel.findOne({ userId }).lean()
  return profile ? toPublicFitnessProfile(profile) : null
}

/** Onboarding for accounts created before FIT-12. Exactly once: the unique index refuses a second profile. */
export async function completeOnboarding(userId: Types.ObjectId, input: FitnessProfileInput): Promise<PublicFitnessProfile> {
  try {
    const [profile] = await FitnessProfileModel.create([{ ...input, userId, onboardingCompletedAt: new Date() }])
    return toPublicFitnessProfile(profile!)
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'ONBOARDING_ALREADY_COMPLETED', 'Your fitness profile is already set up. Update it from your profile page.')
    }
    throw error
  }
}

/** Updates only the validated, allowed fields ($set of a whitelist); userId and timestamps can't be changed. */
export async function updateFitnessProfile(userId: Types.ObjectId, update: Partial<FitnessProfileInput>): Promise<PublicFitnessProfile> {
  const profile = await FitnessProfileModel.findOneAndUpdate(
    { userId },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).lean()
  if (!profile) throw ONBOARDING_REQUIRED()
  return toPublicFitnessProfile(profile)
}
