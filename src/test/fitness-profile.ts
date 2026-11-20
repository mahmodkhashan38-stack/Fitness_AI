import type { FitnessProfile, FitnessProfileInput } from '@/types/fitness-profile'

/** A complete, valid fitness profile for tests. */
export const TEST_PROFILE_INPUT: FitnessProfileInput = {
  sex: 'female',
  age: 29,
  heightCm: 168,
  weightKg: 61.5,
  goal: 'muscle_gain',
  trainingDaysPerWeek: 4,
}

export const TEST_PROFILE: FitnessProfile = {
  ...TEST_PROFILE_INPUT,
  onboardingCompleted: true,
  onboardingCompletedAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
}
