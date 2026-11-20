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
  age: '',
  heightCm: '',
  weightKg: '',
  goal: '',
  trainingDaysPerWeek: '',
}

const MISSING: Record<FitnessProfileField, string> = {
  sex: 'Select your sex.',
  age: 'Enter your age.',
  heightCm: 'Enter your height in centimeters.',
  weightKg: 'Enter your weight in kilograms.',
  goal: 'Choose your main goal.',
  trainingDaysPerWeek: 'Choose how many days a week you train.',
}

const OUT_OF_RANGE = {
  age: `Age must be between ${PROFILE_LIMITS.age.min} and ${PROFILE_LIMITS.age.max}.`,
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

type NumericField = 'age' | 'heightCm' | 'weightKg' | 'trainingDaysPerWeek'

function numberError(field: NumericField, text: string, integer: boolean): string | undefined {
  if (text.trim() === '') return MISSING[field]
  const value = parseTypedNumber(text)
  if (value === null) return MISSING[field]
  if (integer && !Number.isInteger(value)) return field === 'age' ? 'Enter your age in whole years.' : 'Choose a whole number of days.'
  const { min, max } = PROFILE_LIMITS[field]
  if (value < min || value > max) return OUT_OF_RANGE[field]
  return undefined
}

const isSex = (value: string): value is Sex => SEX_OPTIONS.some((option) => option.value === value)
const isGoal = (value: string): value is FitnessGoal => GOAL_OPTIONS.some((option) => option.value === value)

export function validateProfileField(field: FitnessProfileField, values: FitnessProfileFormValues): string | undefined {
  switch (field) {
    case 'sex':
      return isSex(values.sex) ? undefined : MISSING.sex
    case 'goal':
      return isGoal(values.goal) ? undefined : MISSING.goal
    case 'age':
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
): FitnessProfileErrors {
  const errors: FitnessProfileErrors = {}
  for (const field of fields) {
    const message = validateProfileField(field, values)
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
    age: parseTypedNumber(values.age)!,
    heightCm: oneDecimal(parseTypedNumber(values.heightCm)!),
    weightKg: oneDecimal(parseTypedNumber(values.weightKg)!),
    goal: values.goal,
    trainingDaysPerWeek: parseTypedNumber(values.trainingDaysPerWeek)!,
  }
}

/** Pre-fills the form with a stored profile (for editing). */
export function toProfileFormValues(profile: FitnessProfileInput): FitnessProfileFormValues {
  return {
    sex: profile.sex,
    age: String(profile.age),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    goal: profile.goal,
    trainingDaysPerWeek: String(profile.trainingDaysPerWeek),
  }
}

/** Only the fields whose value differs from the stored profile (PATCH body). */
export function changedProfileFields(stored: FitnessProfile, next: FitnessProfileInput): Partial<FitnessProfileInput> {
  const changes: Partial<Record<FitnessProfileField, unknown>> = {}
  for (const field of PROFILE_FIELDS) {
    if (stored[field] !== next[field]) changes[field] = next[field]
  }
  return changes as Partial<FitnessProfileInput>
}

const formatNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)

/** Human-readable values for summaries (review step, profile page). */
export function describeProfile(profile: FitnessProfileInput): Record<FitnessProfileField, string> {
  return {
    sex: SEX_OPTIONS.find((option) => option.value === profile.sex)?.label ?? '',
    age: `${profile.age} years`,
    heightCm: `${formatNumber(profile.heightCm)} cm`,
    weightKg: `${formatNumber(profile.weightKg)} kg`,
    goal: GOAL_OPTIONS.find((option) => option.value === profile.goal)?.label ?? '',
    trainingDaysPerWeek: profile.trainingDaysPerWeek === 1 ? '1 day' : `${profile.trainingDaysPerWeek} days`,
  }
}
