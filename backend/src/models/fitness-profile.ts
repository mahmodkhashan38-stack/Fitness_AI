import { Schema, model, type Types } from 'mongoose'
import { ageInYear, GOALS, PROFILE_LIMITS, SEXES, type FitnessGoal, type Sex } from '../fitness/validation.js'

/**
 * A user's fitness profile (FIT-12): one per user, in its own collection so future modules
 * (workout planning, nutrition targets, progress, AI coach) can read it without touching the
 * authentication data in `users`.
 *
 * A profile is only ever created complete (registration or onboarding), so its existence means
 * onboarding is complete. Values are self-reported, not verified medical information.
 *
 * Age (FIT-14): new and updated profiles store `birthYear`, so the age stays current. Profiles
 * created before FIT-14 store the `age` the user entered until the user adds a birth year (which
 * removes the stored age); nothing is estimated. Exactly one of the two is always present.
 */
export interface FitnessProfile {
  _id: Types.ObjectId
  /** Owner. Unique: one profile per user. Always taken from the session, never from a request. */
  userId: Types.ObjectId
  sex: Sex
  /** Four-digit year (FIT-14). Absent on pre-FIT-14 profiles whose user hasn't added it yet. */
  birthYear?: number
  /** Age as entered before FIT-14 (whole years). Removed when a birth year is stored. */
  age?: number
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
// Coarse bounds only: the exact range depends on the current year and is checked per request.
const BIRTH_YEAR_BOUNDS = { min: [1900, 'birthYear is out of range'] as [number, string], max: [2100, 'birthYear is out of range'] as [number, string] }

const fitnessProfileSchema = new Schema<FitnessProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    sex: { type: String, required: true, enum: { values: SEXES, message: 'sex is invalid' } },
    birthYear: { type: Number, ...BIRTH_YEAR_BOUNDS, validate: integer('birthYear') },
    age: { type: Number, ...range('age'), validate: integer('age') },
    heightCm: { type: Number, required: true, ...range('heightCm') },
    weightKg: { type: Number, required: true, ...range('weightKg') },
    goal: { type: String, required: true, enum: { values: GOALS, message: 'goal is invalid' } },
    trainingDaysPerWeek: { type: Number, required: true, ...range('trainingDaysPerWeek'), validate: integer('trainingDaysPerWeek') },
    onboardingCompletedAt: { type: Date, required: true, immutable: true },
  },
  { timestamps: true, strict: 'throw' },
)

// Applies to created documents. Updates keep the invariant in updateFitnessProfile (setting one
// field unsets the other).
fitnessProfileSchema.pre('validate', function () {
  if ((this.birthYear == null) === (this.age == null)) this.invalidate('birthYear', 'exactly one of birthYear and age is required')
})

// One profile per user, enforced by the database (also against concurrent onboarding requests).
fitnessProfileSchema.index({ userId: 1 }, { unique: true })

export const FitnessProfileModel = model<FitnessProfile>('FitnessProfile', fitnessProfileSchema)

/** The only shape of a fitness profile that leaves the API (no internal ids). */
export interface PublicFitnessProfile {
  sex: Sex
  /** null until a user whose profile predates FIT-14 adds it. */
  birthYear: number | null
  /**
   * Whole years: the age reached this calendar year when the birth year is known, otherwise the
   * age as entered. Always present, so clients from before FIT-14 keep working.
   */
  age: number
  heightCm: number
  weightKg: number
  goal: FitnessGoal
  trainingDaysPerWeek: number
  onboardingCompleted: true
  onboardingCompletedAt: string
  updatedAt: string
}

export function toPublicFitnessProfile(profile: FitnessProfile, now: Date = new Date()): PublicFitnessProfile {
  const birthYear = profile.birthYear ?? null
  const age = birthYear !== null ? ageInYear(birthYear, now.getUTCFullYear()) : profile.age
  // Unreachable while the invariant above holds; a bad document is a server error, not a guess.
  if (age === undefined) throw new Error('Fitness profile has neither birthYear nor age')
  return {
    sex: profile.sex,
    birthYear,
    age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goal: profile.goal,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    onboardingCompleted: true,
    onboardingCompletedAt: profile.onboardingCompletedAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}
