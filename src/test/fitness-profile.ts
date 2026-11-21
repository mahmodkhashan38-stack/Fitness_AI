import type { FitnessProfile, FitnessProfileInput } from '@/types/fitness-profile'

/** Birth year of someone turning `age` this calendar year (UTC, like the app and the API). */
export const birthYearFor = (age: number) => new Date().getUTCFullYear() - age

/** A complete, valid fitness profile for tests. */
export const TEST_PROFILE_INPUT: FitnessProfileInput = {
  sex: 'female',
  birthYear: birthYearFor(29),
  heightCm: 168,
  weightKg: 61.5,
  goal: 'muscle_gain',
  trainingDaysPerWeek: 4,
}

export const TEST_PROFILE: FitnessProfile = {
  ...TEST_PROFILE_INPUT,
  age: 29,
  onboardingCompleted: true,
  onboardingCompletedAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
}

/** A profile saved before FIT-14: the age as entered, no birth year yet. */
export const LEGACY_PROFILE: FitnessProfile = { ...TEST_PROFILE, birthYear: null, age: 41 }
