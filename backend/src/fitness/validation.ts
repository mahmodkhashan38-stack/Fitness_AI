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

/** The calendar year (UTC) that birth years and ages are judged against. */
export const currentYear = (now: Date = new Date()): number => now.getUTCFullYear()

/**
 * Accepted birth years (FIT-14): the user turns 16–100 during the current calendar year. Only the
 * year is collected, so the exact age within that year is unknown; this is the same precision
 * as asking for an age, without going stale.
 */
export function birthYearRange(year: number = currentYear()): { min: number; max: number } {
  return { min: year - PROFILE_LIMITS.age.max, max: year - PROFILE_LIMITS.age.min }
}

/** The age the user reaches in `year` (their age after this year's birthday). */
export const ageInYear = (birthYear: number, year: number = currentYear()): number => year - birthYear

interface ProfileBase {
  sex: Sex
  /** Centimetres, stored to 0.1. */
  heightCm: number
  /** Kilograms, stored to 0.1. */
  weightKg: number
  goal: FitnessGoal
  /** Whole days, 0–7. */
  trainingDaysPerWeek: number
}

/**
 * A complete profile. Current clients send `birthYear`; clients from before FIT-14 (an installed
 * app that hasn't reloaded yet) send `age`, which is still accepted and stored as entered.
 * Exactly one of the two is present.
 */
export type FitnessProfileInput = ProfileBase & ({ birthYear: number; age?: undefined } | { age: number; birthYear?: undefined })

/** A partial update. At most one of `birthYear` and `age`. */
export type FitnessProfileUpdate = Partial<ProfileBase> & { birthYear?: number; age?: number }

/** The profile fields of the current API, in the order they are presented and validated. */
export const PROFILE_FIELDS = ['sex', 'birthYear', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek'] as const
export type FitnessProfileField = (typeof PROFILE_FIELDS)[number]

/** Accepted keys: the current fields plus the pre-FIT-14 `age`. */
const ACCEPTED_KEYS: readonly string[] = [...PROFILE_FIELDS, 'age']

type NumberField = 'age' | 'heightCm' | 'weightKg' | 'trainingDaysPerWeek'
type ValueField = Exclude<FitnessProfileField, 'birthYear'>

const MISSING: Record<FitnessProfileField | 'age', string> = {
  sex: 'Select your sex.',
  birthYear: 'Enter your birth year.',
  age: 'Enter your age.',
  heightCm: 'Enter your height in centimeters.',
  weightKg: 'Enter your weight in kilograms.',
  goal: 'Choose your main goal.',
  trainingDaysPerWeek: 'Choose how many days a week you train.',
}

const OUT_OF_RANGE: Record<NumberField, string> = {
  age: `Age must be between ${PROFILE_LIMITS.age.min} and ${PROFILE_LIMITS.age.max}.`,
  heightCm: `Height must be between ${PROFILE_LIMITS.heightCm.min} and ${PROFILE_LIMITS.heightCm.max} cm.`,
  weightKg: `Weight must be between ${PROFILE_LIMITS.weightKg.min} and ${PROFILE_LIMITS.weightKg.max} kg.`,
  trainingDaysPerWeek: `Choose between ${PROFILE_LIMITS.trainingDaysPerWeek.min} and ${PROFILE_LIMITS.trainingDaysPerWeek.max} days.`,
}

const BOTH_AGE_FIELDS = 'Send a birth year or an age, not both.'

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value)

/** JSON numbers only: strings such as "70" or "", null, NaN and Infinity are refused, never coerced. */
const isPresentNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function readNumber(field: NumberField, value: unknown, fields: Record<string, string>, integer: boolean): number | undefined {
  if (!isPresentNumber(value)) {
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

function readBirthYear(value: unknown, fields: Record<string, string>, year: number): number | undefined {
  if (!isPresentNumber(value)) {
    fields.birthYear = MISSING.birthYear
    return undefined
  }
  const { min, max } = birthYearRange(year)
  if (!Number.isInteger(value)) {
    fields.birthYear = 'Enter your birth year as a 4-digit year.'
    return undefined
  }
  if (value < min || value > max) {
    fields.birthYear = `Birth year must be between ${min} and ${max}.`
    return undefined
  }
  return value
}

function readField(field: ValueField, value: unknown, fields: Record<string, string>): ProfileBase[ValueField] | undefined {
  switch (field) {
    case 'sex':
      if (isOneOf(SEXES, value)) return value
      fields.sex = MISSING.sex
      return undefined
    case 'goal':
      if (isOneOf(GOALS, value)) return value
      fields.goal = MISSING.goal
      return undefined
    case 'trainingDaysPerWeek':
      return readNumber(field, value, fields, true)
    case 'heightCm':
    case 'weightKg':
      return readNumber(field, value, fields, false)
  }
}

/**
 * Reads the birth year, or the legacy age when that is what was sent (never both). Problems
 * are reported under the key that was sent.
 */
function readAgeFields(data: Record<string, unknown>, fields: Record<string, string>, year: number): { birthYear: number } | { age: number } | undefined {
  if (data.age !== undefined && data.birthYear !== undefined) {
    fields.birthYear = BOTH_AGE_FIELDS
    return undefined
  }
  if (data.age !== undefined) {
    const age = readNumber('age', data.age, fields, true)
    return age === undefined ? undefined : { age }
  }
  const birthYear = readBirthYear(data.birthYear, fields, year)
  return birthYear === undefined ? undefined : { birthYear }
}

/**
 * Validates a complete profile (registration and onboarding). Problems are added to `fields`
 * so they can be reported together with other fields; returns null if anything is invalid.
 */
export function parseFitnessProfile(value: unknown, fields: Record<string, string>, now: Date = new Date()): FitnessProfileInput | null {
  const data = value === undefined ? {} : readObject(value, ACCEPTED_KEYS, 'profile')
  const result: Record<string, unknown> = {}
  let valid = true
  for (const field of PROFILE_FIELDS) {
    const parsed = field === 'birthYear' ? readAgeFields(data, fields, currentYear(now)) : readField(field, data[field], fields)
    if (parsed === undefined) valid = false
    else if (field === 'birthYear') Object.assign(result, parsed)
    else result[field] = parsed
  }
  return valid ? (result as unknown as FitnessProfileInput) : null
}

/** Body of POST /api/users/me/fitness-profile (complete onboarding): every field is required. */
export function parseOnboarding(body: unknown, now: Date = new Date()): FitnessProfileInput {
  const fields: Record<string, string> = {}
  const profile = parseFitnessProfile(body, fields, now)
  if (!profile) throw validationError(fields)
  return profile
}

/** Body of PATCH /api/users/me/fitness-profile: any non-empty subset of the profile fields, each fully validated. */
export function parseFitnessProfileUpdate(body: unknown, now: Date = new Date()): FitnessProfileUpdate {
  const data = readObject(body, ACCEPTED_KEYS)
  const present = ACCEPTED_KEYS.filter((key) => data[key] !== undefined)
  if (present.length === 0) throw new HttpError(400, 'VALIDATION_FAILED', 'Provide at least one field to update.')

  const fields: Record<string, string> = {}
  const update: Record<string, unknown> = {}
  for (const field of PROFILE_FIELDS) {
    if (field === 'birthYear') {
      if (data.birthYear === undefined && data.age === undefined) continue
      Object.assign(update, readAgeFields(data, fields, currentYear(now)))
    } else if (data[field] !== undefined) {
      const parsed = readField(field, data[field], fields)
      if (parsed !== undefined) update[field] = parsed
    }
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)
  return update as FitnessProfileUpdate
}
