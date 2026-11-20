import { Schema, model, type Types } from 'mongoose'
import { GOALS, PROFILE_LIMITS, SEXES, type FitnessGoal, type Sex } from '../fitness/validation.js'

/**
 * A user's fitness profile (FIT-12): one per user, in its own collection so future modules
 * (workout planning, nutrition targets, progress, AI coach) can read it without touching the
 * authentication data in `users`.
 *
 * A profile is only ever created complete (registration or onboarding), so its existence means
 * onboarding is complete. Values are self-reported, not verified medical information.
 */
export interface FitnessProfile {
  _id: Types.ObjectId
  /** Owner. Unique: one profile per user. Always taken from the session, never from a request. */
  userId: Types.ObjectId
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  goal: FitnessGoal
  trainingDaysPerWeek: number
  /** When onboarding was completed (registration or the onboarding flow for existing users). */
  onboardingCompletedAt: Date
  createdAt: Date
  updatedAt: Date
}

// Defence in depth behind the request validation (fitness/validation.ts). Messages never include
// {VALUE}: a validation error that reached the logs must not contain personal data.
const range = (field: keyof typeof PROFILE_LIMITS) => ({
  min: [PROFILE_LIMITS[field].min, `${field} is out of range`] as [number, string],
  max: [PROFILE_LIMITS[field].max, `${field} is out of range`] as [number, string],
})
const integer = (field: string) => ({ validator: Number.isInteger, message: `${field} must be an integer` })

const fitnessProfileSchema = new Schema<FitnessProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    sex: { type: String, required: true, enum: { values: SEXES, message: 'sex is invalid' } },
    age: { type: Number, required: true, ...range('age'), validate: integer('age') },
    heightCm: { type: Number, required: true, ...range('heightCm') },
    weightKg: { type: Number, required: true, ...range('weightKg') },
    goal: { type: String, required: true, enum: { values: GOALS, message: 'goal is invalid' } },
    trainingDaysPerWeek: { type: Number, required: true, ...range('trainingDaysPerWeek'), validate: integer('trainingDaysPerWeek') },
    onboardingCompletedAt: { type: Date, required: true, immutable: true },
  },
  { timestamps: true, strict: 'throw' },
)

// One profile per user, enforced by the database (also against concurrent onboarding requests).
fitnessProfileSchema.index({ userId: 1 }, { unique: true })

export const FitnessProfileModel = model<FitnessProfile>('FitnessProfile', fitnessProfileSchema)

/** The only shape of a fitness profile that leaves the API (no internal ids). */
export interface PublicFitnessProfile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  goal: FitnessGoal
  trainingDaysPerWeek: number
  onboardingCompleted: true
  onboardingCompletedAt: string
  updatedAt: string
}

export function toPublicFitnessProfile(profile: FitnessProfile): PublicFitnessProfile {
  return {
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goal: profile.goal,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    onboardingCompleted: true,
    onboardingCompletedAt: profile.onboardingCompletedAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}
