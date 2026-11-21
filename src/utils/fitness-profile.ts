import { GOAL_OPTIONS, PROFILE_FIELDS, PROFILE_LIMITS, SEX_OPTIONS } from '@/constants/fitness-profile'
import type {
  FitnessGoal,
  FitnessProfile,
  FitnessProfileErrors,
  FitnessProfileField,
  FitnessProfileFormValues,
  FitnessProfileInput,
  Sex,
} from '@/types/fitness-profile'

/**
 * Client-side mirror of the API's fitness profile rules, for instant feedback.
 * The server validates again and is authoritative.
 */

export const EMPTY_PROFILE_FORM: FitnessProfileFormValues = {
  sex: '',
  birthYear: '',
  heightCm: '',
  weightKg: '',
  goal: '',
  trainingDaysPerWeek: '',
}

const MISSING: Record<FitnessProfileField, string> = {
  sex: 'Select your sex.',
  birthYear: 'Enter your birth year.',
  heightCm: 'Enter your height in centimeters.',
  weightKg: 'Enter your weight in kilograms.',
  goal: 'Choose your main goal.',
  trainingDaysPerWeek: 'Choose how many days a week you train.',
}

const OUT_OF_RANGE = {
  heightCm: `Height must be between ${PROFILE_LIMITS.heightCm.min} and ${PROFILE_LIMITS.heightCm.max} cm.`,
  weightKg: `Weight must be between ${PROFILE_LIMITS.weightKg.min} and ${PROFILE_LIMITS.weightKg.max} kg.`,
  trainingDaysPerWeek: `Choose between ${PROFILE_LIMITS.trainingDaysPerWeek.min} and ${PROFILE_LIMITS.trainingDaysPerWeek.max} days.`,
} as const

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Parses a typed number. Accepts a decimal comma (iOS shows "," on many regional keypads) and
 * surrounding spaces; anything else (letters, signs, exponents, several separators) is invalid.
 */
export function parseTypedNumber(text: string): number | null {
  const normalised = text.trim().replace(',', '.')
  if (!DECIMAL.test(normalised)) return null
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/** The calendar year birth years are judged against: UTC, like the API, so both apply the same rule. */
export const currentYear = (now: Date = new Date()): number => now.getUTCFullYear()

/** Accepted birth years: the user turns 16–100 during `year`. */
export function birthYearRange(year: number = currentYear()): { min: number; max: number } {
  return { min: year - PROFILE_LIMITS.age.max, max: year - PROFILE_LIMITS.age.min }
}

type NumericField = 'heightCm' | 'weightKg' | 'trainingDaysPerWeek'

function birthYearError(text: string, year: number): string | undefined {
  const value = parseTypedNumber(text)
  if (value === null) return MISSING.birthYear
  if (!Number.isInteger(value)) return 'Enter your birth year as a 4-digit year.'
  const { min, max } = birthYearRange(year)
  if (value < min || value > max) return `Birth year must be between ${min} and ${max}.`
  return undefined
}

function numberError(field: NumericField, text: string, integer: boolean): string | undefined {
  if (text.trim() === '') return MISSING[field]
  const value = parseTypedNumber(text)
  if (value === null) return MISSING[field]
  if (integer && !Number.isInteger(value)) return 'Choose a whole number of days.'
  const { min, max } = PROFILE_LIMITS[field]
  if (value < min || value > max) return OUT_OF_RANGE[field]
  return undefined
}

const isSex = (value: string): value is Sex => SEX_OPTIONS.some((option) => option.value === value)
const isGoal = (value: string): value is FitnessGoal => GOAL_OPTIONS.some((option) => option.value === value)

export interface ProfileValidationOptions {
  /**
   * The birth year may be left blank: the profile was saved before FIT-14 and keeps its stored
   * age until the user adds one.
   */
  birthYearOptional?: boolean
  /** Defaults to the current UTC year. */
  year?: number
}

export function validateProfileField(
  field: FitnessProfileField,
  values: FitnessProfileFormValues,
  { birthYearOptional = false, year = currentYear() }: ProfileValidationOptions = {},
): string | undefined {
  switch (field) {
    case 'sex':
      return isSex(values.sex) ? undefined : MISSING.sex
    case 'goal':
      return isGoal(values.goal) ? undefined : MISSING.goal
    case 'birthYear':
      if (values.birthYear.trim() === '') return birthYearOptional ? undefined : MISSING.birthYear
      return birthYearError(values.birthYear, year)
    case 'trainingDaysPerWeek':
      return numberError(field, values[field], true)
    case 'heightCm':
    case 'weightKg':
      return numberError(field, values[field], false)
  }
}

/** Errors for the given fields (default: all), in display order. */
export function validateProfileForm(
  values: FitnessProfileFormValues,
  fields: readonly FitnessProfileField[] = PROFILE_FIELDS,
  options: ProfileValidationOptions = {},
): FitnessProfileErrors {
  const errors: FitnessProfileErrors = {}
  for (const field of fields) {
    const message = validateProfileField(field, values, options)
    if (message) errors[field] = message
  }
  return errors
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10

/** Converts validated form values to the API input. Throws if called with invalid values. */
export function toProfileInput(values: FitnessProfileFormValues): FitnessProfileInput {
  if (Object.keys(validateProfileForm(values)).length > 0 || !isSex(values.sex) || !isGoal(values.goal)) {
    throw new Error('toProfileInput called with invalid values')
  }
  return {
    sex: values.sex,
    birthYear: parseTypedNumber(values.birthYear)!,
    heightCm: oneDecimal(parseTypedNumber(values.heightCm)!),
    weightKg: oneDecimal(parseTypedNumber(values.weightKg)!),
    goal: values.goal,
    trainingDaysPerWeek: parseTypedNumber(values.trainingDaysPerWeek)!,
  }
}

/** Pre-fills the form with a stored profile (for editing). A missing birth year stays blank. */
export function toProfileFormValues(profile: FitnessProfile): FitnessProfileFormValues {
  return {
    sex: profile.sex,
    birthYear: profile.birthYear === null ? '' : String(profile.birthYear),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    goal: profile.goal,
    trainingDaysPerWeek: String(profile.trainingDaysPerWeek),
  }
}

/**
 * Only the fields whose value differs from the stored profile (PATCH body). `values` must have
 * passed validation; a blank birth year (allowed for profiles saved before FIT-14) is not sent,
 * so the stored age is kept.
 */
export function changedProfileFields(stored: FitnessProfile, values: FitnessProfileFormValues): Partial<FitnessProfileInput> {
  if (!isSex(values.sex) || !isGoal(values.goal)) throw new Error('changedProfileFields called with invalid values')
  const next: Partial<FitnessProfileInput> = {
    sex: values.sex,
    heightCm: oneDecimal(parseTypedNumber(values.heightCm)!),
    weightKg: oneDecimal(parseTypedNumber(values.weightKg)!),
    goal: values.goal,
    trainingDaysPerWeek: parseTypedNumber(values.trainingDaysPerWeek)!,
  }
  if (values.birthYear.trim() !== '') next.birthYear = parseTypedNumber(values.birthYear)!
  const changes: Partial<Record<FitnessProfileField, unknown>> = {}
  for (const field of PROFILE_FIELDS) {
    if (next[field] !== undefined && next[field] !== stored[field]) changes[field] = next[field]
  }
  return changes as Partial<FitnessProfileInput>
}

const formatNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)

/** Human-readable values for summaries (review step, profile page). */
export function describeProfile(profile: FitnessProfileInput | FitnessProfile): Record<FitnessProfileField, string> {
  return {
    sex: SEX_OPTIONS.find((option) => option.value === profile.sex)?.label ?? '',
    birthYear: profile.birthYear === null ? 'Not added' : String(profile.birthYear),
    heightCm: `${formatNumber(profile.heightCm)} cm`,
    weightKg: `${formatNumber(profile.weightKg)} kg`,
    goal: GOAL_OPTIONS.find((option) => option.value === profile.goal)?.label ?? '',
    trainingDaysPerWeek: profile.trainingDaysPerWeek === 1 ? '1 day' : `${profile.trainingDaysPerWeek} days`,
  }
}

/**
 * The stored profile's age for display. With a birth year the exact birthday is unknown, so it
 * is the age reached this year; without one it is the age as entered (it doesn't update).
 */
export function describeAge(profile: FitnessProfile): string {
  return profile.birthYear === null ? `${profile.age} years` : `${profile.age} this year`
}
