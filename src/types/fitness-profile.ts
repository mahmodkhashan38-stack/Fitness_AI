/**
 * Fitness profile (FIT-12). Mirrors the API contract of /api/users/me/fitness-profile
 * (backend/src/fitness/validation.ts). Values are self-reported, not medical information.
 */
export type Sex = 'male' | 'female'

export type FitnessGoal = 'muscle_gain' | 'fat_loss' | 'maintenance' | 'general_fitness'

/** What the user submits at registration or onboarding. Metric units only. */
export interface FitnessProfileInput {
  sex: Sex
  /** Four-digit year (FIT-14): the age is derived from it, so it never goes stale. */
  birthYear: number
  heightCm: number
  weightKg: number
  goal: FitnessGoal
  /** Whole days, 0–7. */
  trainingDaysPerWeek: number
}

export type FitnessProfileField = keyof FitnessProfileInput

/** The stored profile as returned by the API. */
export interface FitnessProfile extends Omit<FitnessProfileInput, 'birthYear'> {
  /**
   * null for a profile saved before FIT-14 whose user hasn't added a birth year yet; such a
   * profile keeps the age the user entered.
   */
  birthYear: number | null
  /** Whole years: the age reached this calendar year, or the age as entered when birthYear is null. */
  age: number
  onboardingCompleted: true
  /** ISO 8601 instant. */
  onboardingCompletedAt: string
  /** ISO 8601 instant. */
  updatedAt: string
}

/**
 * Raw form state: text inputs hold strings (what the user typed), choices are '' until picked.
 * Converted to FitnessProfileInput only after validation.
 */
export interface FitnessProfileFormValues {
  sex: Sex | ''
  birthYear: string
  heightCm: string
  weightKg: string
  goal: FitnessGoal | ''
  trainingDaysPerWeek: string
}

export type FitnessProfileErrors = Partial<Record<FitnessProfileField, string>>
