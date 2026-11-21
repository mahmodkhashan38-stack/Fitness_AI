import type { FitnessGoal, FitnessProfileField, Sex } from '@/types/fitness-profile'

/**
 * Inclusive limits, identical to the API (backend/src/fitness/validation.ts). Birth years are
 * limited through `age`: the user turns 16–100 this calendar year (see birthYearRange).
 */
export const PROFILE_LIMITS = {
  age: { min: 16, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  trainingDaysPerWeek: { min: 0, max: 7 },
} as const

/** Display and validation order. */
export const PROFILE_FIELDS: readonly FitnessProfileField[] = ['sex', 'birthYear', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek']

export const SEX_OPTIONS: readonly { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

export const GOAL_OPTIONS: readonly { value: FitnessGoal; label: string; description: string }[] = [
  { value: 'muscle_gain', label: 'Muscle Gain', description: 'Build strength and muscle size.' },
  { value: 'fat_loss', label: 'Fat Loss', description: 'Lose body fat while keeping muscle.' },
  { value: 'maintenance', label: 'Maintenance', description: 'Keep your current shape and weight.' },
  { value: 'general_fitness', label: 'General Fitness / Endurance', description: 'Feel fitter, move better, last longer.' },
]

export const TRAINING_DAY_OPTIONS: readonly { value: string; label: string }[] = Array.from({ length: 8 }, (_, days) => ({
  value: String(days),
  label: String(days),
}))

export const PROFILE_FIELD_LABELS: Record<FitnessProfileField, string> = {
  sex: 'Sex',
  birthYear: 'Birth year',
  heightCm: 'Height',
  weightKg: 'Weight',
  goal: 'Main goal',
  trainingDaysPerWeek: 'Training days per week',
}
