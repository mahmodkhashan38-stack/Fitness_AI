import type { Types } from 'mongoose'
import type { FitnessProfileInput, FitnessProfileUpdate } from '../fitness/validation.js'
import { FitnessProfileModel, toPublicFitnessProfile, type PublicFitnessProfile } from '../models/fitness-profile.js'
import { HttpError } from '../utils/http-error.js'
import { validationError } from '../utils/validation.js'
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

/**
 * An age sent by a pre-FIT-14 client for a profile whose birth year is already stored. Reported on
 * the `age` field, which those clients show next to their Age input.
 */
export const BIRTH_YEAR_ALREADY_SAVED = () =>
  validationError({ age: 'Your birth year is already saved, so your age updates automatically. Reload Fitness AI to see it.' })

/**
 * Updates only the validated, allowed fields ($set of a whitelist); userId and timestamps can't be
 * changed. Storing a birth year removes the stored age (it would only go stale).
 *
 * An `age` (sent only by pre-FIT-14 clients) is accepted only while the profile has no birth year:
 * a confirmed birth year is never overwritten or removed by it. The condition is part of the
 * update's filter, so it also holds against a concurrent request that adds a birth year. When it
 * doesn't match, nothing is written (not even the request's other fields).
 */
export async function updateFitnessProfile(userId: Types.ObjectId, update: FitnessProfileUpdate): Promise<PublicFitnessProfile> {
  const legacyAge = update.age !== undefined
  // `birthYear: null` matches documents where the field is absent.
  const filter = legacyAge ? { userId, birthYear: null } : { userId }
  const profile = await FitnessProfileModel.findOneAndUpdate(
    filter,
    { $set: update, ...(update.birthYear !== undefined ? { $unset: { age: 1 } } : {}) },
    { returnDocument: 'after', runValidators: true },
  ).lean()
  if (profile) return toPublicFitnessProfile(profile)
  if (legacyAge && (await hasFitnessProfile(userId))) throw BIRTH_YEAR_ALREADY_SAVED()
  throw ONBOARDING_REQUIRED()
}
