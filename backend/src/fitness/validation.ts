import { HttpError } from '../utils/http-error.js'
import { readObject, validationError } from '../utils/validation.js'

/**
 * Fitness profile rules (FIT-12). The values are user-provided self-reports used to personalise
 * the app, not verified medical information. The frontend mirrors these rules for instant
 * feedback (src/utils/fitness-profile.ts); the server is authoritative.
 */

export const SEXES = ['male', 'female'] as const
export const GOALS = ['muscle_gain', 'fat_loss', 'maintenance', 'general_fitness'] as const

export type Sex = (typeof SEXES)[number]
export type FitnessGoal = (typeof GOALS)[number]

/** Inclusive ranges. Age 16+: the app's plans and future nutrition targets are designed for adults and older teens. */
export const PROFILE_LIMITS = {
  age: { min: 16, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  trainingDaysPerWeek: { min: 0, max: 7 },
} as const

export interface FitnessProfileInput {
  sex: Sex
  /** Whole years. */
  age: number
  /** Centimetres, stored to 0.1. */
  heightCm: number
  /** Kilograms, stored to 0.1. */
  weightKg: number
  goal: FitnessGoal
  /** Whole days, 0–7. */
  trainingDaysPerWeek: number
}

export type FitnessProfileField = keyof FitnessProfileInput

/** Order in which fields are presented and validated. */
export const PROFILE_FIELDS: readonly FitnessProfileField[] = ['sex', 'age', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek']

const MISSING: Record<FitnessProfileField, string> = {
  sex: 'Select your sex.',
  age: 'Enter your age.',
  heightCm: 'Enter your height in centimeters.',
  weightKg: 'Enter your weight in kilograms.',
  goal: 'Choose your main goal.',
  trainingDaysPerWeek: 'Choose how many days a week you train.',
}

const OUT_OF_RANGE: Record<'age' | 'heightCm' | 'weightKg' | 'trainingDaysPerWeek', string> = {
  age: `Age must be between ${PROFILE_LIMITS.age.min} and ${PROFILE_LIMITS.age.max}.`,
  heightCm: `Height must be between ${PROFILE_LIMITS.heightCm.min} and ${PROFILE_LIMITS.heightCm.max} cm.`,
  weightKg: `Weight must be between ${PROFILE_LIMITS.weightKg.min} and ${PROFILE_LIMITS.weightKg.max} kg.`,
  trainingDaysPerWeek: `Choose between ${PROFILE_LIMITS.trainingDaysPerWeek.min} and ${PROFILE_LIMITS.trainingDaysPerWeek.max} days.`,
}

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value)

/** JSON numbers only: strings such as "70" or "", null, NaN and Infinity are refused, never coerced. */
function readNumber(field: 'age' | 'heightCm' | 'weightKg' | 'trainingDaysPerWeek', value: unknown, fields: Record<string, string>, integer: boolean): number | undefined {
  if (value === undefined || value === null || value === '') {
    fields[field] = MISSING[field]
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fields[field] = MISSING[field]
    return undefined
  }
  if (integer && !Number.isInteger(value)) {
    fields[field] = field === 'age' ? 'Enter your age in whole years.' : 'Choose a whole number of days.'
    return undefined
  }
  const { min, max } = PROFILE_LIMITS[field]
  if (value < min || value > max) {
    fields[field] = OUT_OF_RANGE[field]
    return undefined
  }
  // Measurements keep one decimal (e.g. 72.5 kg); more precision is meaningless for self-reported values.
  return integer ? value : Math.round(value * 10) / 10
}

function readField(field: FitnessProfileField, value: unknown, fields: Record<string, string>): FitnessProfileInput[FitnessProfileField] | undefined {
  switch (field) {
    case 'sex':
      if (isOneOf(SEXES, value)) return value
      fields.sex = MISSING.sex
      return undefined
    case 'goal':
      if (isOneOf(GOALS, value)) return value
      fields.goal = MISSING.goal
      return undefined
    case 'age':
    case 'trainingDaysPerWeek':
      return readNumber(field, value, fields, true)
    case 'heightCm':
    case 'weightKg':
      return readNumber(field, value, fields, false)
  }
}

/**
 * Validates a complete profile (registration and onboarding). Problems are added to `fields`
 * so they can be reported together with other fields; returns null if anything is invalid.
 */
export function parseFitnessProfile(value: unknown, fields: Record<string, string>): FitnessProfileInput | null {
  const data = value === undefined ? {} : readObject(value, PROFILE_FIELDS, 'profile')
  const result: Partial<Record<FitnessProfileField, unknown>> = {}
  let valid = true
  for (const field of PROFILE_FIELDS) {
    const parsed = readField(field, data[field], fields)
    if (parsed === undefined) valid = false
    else result[field] = parsed
  }
  return valid ? (result as unknown as FitnessProfileInput) : null
}

/** Body of POST /api/users/me/fitness-profile (complete onboarding): every field is required. */
export function parseOnboarding(body: unknown): FitnessProfileInput {
  const fields: Record<string, string> = {}
  const profile = parseFitnessProfile(body, fields)
  if (!profile) throw validationError(fields)
  return profile
}

/** Body of PATCH /api/users/me/fitness-profile: any non-empty subset of the profile fields, each fully validated. */
export function parseFitnessProfileUpdate(body: unknown): Partial<FitnessProfileInput> {
  const data = readObject(body, PROFILE_FIELDS)
  const present = PROFILE_FIELDS.filter((field) => data[field] !== undefined)
  if (present.length === 0) throw new HttpError(400, 'VALIDATION_FAILED', 'Provide at least one field to update.')

  const fields: Record<string, string> = {}
  const update: Partial<Record<FitnessProfileField, unknown>> = {}
  for (const field of present) {
    const parsed = readField(field, data[field], fields)
    if (parsed !== undefined) update[field] = parsed
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)
  return update as Partial<FitnessProfileInput>
}
