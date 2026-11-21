import { describe, expect, it } from 'vitest'
import { ageInYear, birthYearRange, parseFitnessProfile, parseFitnessProfileUpdate, parseOnboarding, PROFILE_FIELDS } from '../src/fitness/validation.js'
import { FitnessProfileModel, toPublicFitnessProfile, type FitnessProfile } from '../src/models/fitness-profile.js'
import { HttpError } from '../src/utils/http-error.js'
import mongoose from 'mongoose'
import { birthYearFor, validProfile } from './support/client.js'

const THIS_YEAR = new Date().getUTCFullYear()
/** The legacy (pre-FIT-14) form of a profile: an age instead of a birth year. */
const legacyProfile = (overrides: Record<string, unknown> = {}) => {
  const profile: Record<string, unknown> = { ...validProfile(), age: 29, ...overrides }
  delete profile.birthYear
  return profile
}

function errorOf(fn: () => unknown): HttpError {
  try {
    fn()
  } catch (error) {
    if (error instanceof HttpError) return error
    throw error
  }
  throw new Error('expected an HttpError')
}

const fieldsFor = (profile: unknown) => {
  const fields: Record<string, string> = {}
  const result = parseFitnessProfile(profile, fields)
  return { result, fields }
}

describe('parseFitnessProfile', () => {
  it('accepts a complete profile', () => {
    expect(fieldsFor(validProfile())).toEqual({ result: validProfile(), fields: {} })
  })

  it('accepts every boundary value', () => {
    for (const profile of [
      validProfile({ birthYear: birthYearFor(16), heightCm: 100, weightKg: 30, trainingDaysPerWeek: 0, sex: 'male', goal: 'fat_loss' }),
      validProfile({ birthYear: birthYearFor(100), heightCm: 250, weightKg: 300, trainingDaysPerWeek: 7, goal: 'maintenance' }),
      validProfile({ goal: 'general_fitness' }),
    ]) {
      expect(fieldsFor(profile).fields).toEqual({})
    }
  })

  it('stores height and weight to one decimal', () => {
    expect(fieldsFor(validProfile({ heightCm: 175.26, weightKg: 72.449 })).result).toMatchObject({ heightCm: 175.3, weightKg: 72.4 })
  })

  it('reports every missing field with its own message when the profile is absent', () => {
    const { result, fields } = fieldsFor(undefined)
    expect(result).toBeNull()
    expect(Object.keys(fields)).toEqual([...PROFILE_FIELDS])
    expect(fields).toEqual({
      sex: 'Select your sex.',
      birthYear: 'Enter your birth year.',
      heightCm: 'Enter your height in centimeters.',
      weightKg: 'Enter your weight in kilograms.',
      goal: 'Choose your main goal.',
      trainingDaysPerWeek: 'Choose how many days a week you train.',
    })
  })

  it.each([
    ['birthYear', birthYearFor(15), `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    ['birthYear', birthYearFor(101), `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    ['birthYear', THIS_YEAR, `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    ['birthYear', -1, `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    ['birthYear', 1990.5, 'Enter your birth year as a 4-digit year.'],
    ['birthYear', '1990', 'Enter your birth year.'],
    ['birthYear', null, 'Enter your birth year.'],
    ['heightCm', 99.9, 'Height must be between 100 and 250 cm.'],
    ['heightCm', 250.1, 'Height must be between 100 and 250 cm.'],
    ['weightKg', 29.9, 'Weight must be between 30 and 300 kg.'],
    ['weightKg', 300.5, 'Weight must be between 30 and 300 kg.'],
    ['trainingDaysPerWeek', -1, 'Choose between 0 and 7 days.'],
    ['trainingDaysPerWeek', 8, 'Choose between 0 and 7 days.'],
    ['trainingDaysPerWeek', 3.5, 'Choose a whole number of days.'],
  ])('rejects %s = %s', (field, value, message) => {
    const { result, fields } = fieldsFor(validProfile({ [field]: value }))
    expect(result).toBeNull()
    expect(fields).toEqual({ [field]: message })
  })

  it.each([
    ['sex', 'other'],
    ['sex', 'Male'],
    ['sex', ''],
    ['goal', 'bulk'],
    ['goal', 'MUSCLE_GAIN'],
    ['goal', 1],
  ])('rejects %s = %j (fixed options only, case-sensitive)', (field, value) => {
    expect(Object.keys(fieldsFor(validProfile({ [field]: value })).fields)).toEqual([field])
  })

  it.each(['70', '', null, true, [70], { value: 70 }, Number.NaN, Number.POSITIVE_INFINITY])(
    'never coerces a non-number weight (%j)',
    (value) => {
      expect(fieldsFor(validProfile({ weightKg: value })).fields).toEqual({ weightKg: 'Enter your weight in kilograms.' })
    },
  )

  it.each(['userId', '_id', 'onboardingCompletedAt', 'createdAt', 'bodyFat'])('rejects the unknown field %s inside the profile', (key) => {
    const error = errorOf(() => fieldsFor(validProfile({ [key]: 'x' })))
    expect(error.status).toBe(400)
    expect(error.message).toBe(`Unexpected field: ${key}.`)
  })

  it.each(['female', 42, [validProfile()], null])('rejects a profile that is not an object (%j)', (value) => {
    expect(errorOf(() => fieldsFor(value)).message).toBe('profile must be a JSON object.')
  })
})

describe('birth year (FIT-14)', () => {
  it('allows users who turn 16 to 100 in the current UTC year', () => {
    expect(birthYearRange(2026)).toEqual({ min: 1926, max: 2010 })
    expect(ageInYear(1997, 2026)).toBe(29)
  })

  it('judges the range against the year of the request, so it moves with time', () => {
    const fields: Record<string, string> = {}
    const profile = validProfile({ birthYear: 2010 })
    expect(parseFitnessProfile(profile, fields, new Date('2026-01-01T00:00:00Z'))).toMatchObject({ birthYear: 2010 })
    expect(parseFitnessProfile(profile, fields, new Date('2025-12-31T23:59:59Z'))).toBeNull()
    expect(fields).toEqual({ birthYear: 'Birth year must be between 1925 and 2009.' })
  })

  it('still accepts the pre-FIT-14 age from clients that have not updated yet, with the FIT-12 rules', () => {
    expect(fieldsFor(legacyProfile())).toEqual({ result: legacyProfile(), fields: {} })
    expect(fieldsFor(legacyProfile({ age: 15 })).fields).toEqual({ age: 'Age must be between 16 and 100.' })
    expect(fieldsFor(legacyProfile({ age: 29.5 })).fields).toEqual({ age: 'Enter your age in whole years.' })
  })

  it('refuses a birth year and an age together', () => {
    expect(fieldsFor(validProfile({ age: 29 })).fields).toEqual({ birthYear: 'Send a birth year or an age, not both.' })
    expect(errorOf(() => parseFitnessProfileUpdate({ birthYear: 1990, age: 30 })).fields).toEqual({ birthYear: 'Send a birth year or an age, not both.' })
  })
})

describe('parseOnboarding', () => {
  it('requires every field', () => {
    expect(parseOnboarding(validProfile())).toEqual(validProfile())
    const error = errorOf(() => parseOnboarding({ sex: 'male' }))
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(error.fields ?? {})).toEqual(['birthYear', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek'])
  })
})

describe('parseFitnessProfileUpdate', () => {
  it('accepts any non-empty subset and validates each value', () => {
    expect(parseFitnessProfileUpdate({ weightKg: 70.04 })).toEqual({ weightKg: 70 })
    expect(parseFitnessProfileUpdate({ goal: 'fat_loss', trainingDaysPerWeek: 0 })).toEqual({ goal: 'fat_loss', trainingDaysPerWeek: 0 })
  })

  it('requires at least one field', () => {
    expect(errorOf(() => parseFitnessProfileUpdate({})).message).toBe('Provide at least one field to update.')
  })

  it('accepts a birth year, or a legacy age, on its own', () => {
    expect(parseFitnessProfileUpdate({ birthYear: 1990 })).toEqual({ birthYear: 1990 })
    expect(parseFitnessProfileUpdate({ age: 40 })).toEqual({ age: 40 })
  })

  it('refuses null instead of clearing a mandatory field', () => {
    expect(errorOf(() => parseFitnessProfileUpdate({ birthYear: null })).fields).toEqual({ birthYear: 'Enter your birth year.' })
    expect(errorOf(() => parseFitnessProfileUpdate({ age: null })).fields).toEqual({ age: 'Enter your age.' })
  })

  it('reports every invalid field', () => {
    expect(errorOf(() => parseFitnessProfileUpdate({ birthYear: birthYearFor(12), goal: 'x' })).fields).toEqual({
      birthYear: `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`,
      goal: 'Choose your main goal.',
    })
  })

  it.each([
    { userId: new mongoose.Types.ObjectId().toString() },
    { onboardingCompletedAt: '2020-01-01' },
    { updatedAt: 'x' },
    { $set: { birthYear: 1990 } },
    { $unset: { birthYear: 1 } },
  ])('rejects fields outside the whitelist (%j)', (body) => {
    expect(errorOf(() => parseFitnessProfileUpdate({ birthYear: 1990, ...body })).status).toBe(400)
  })
})

describe('FitnessProfile schema (defence in depth)', () => {
  it('rejects out-of-range values without echoing them in the error message', async () => {
    const doc = new FitnessProfileModel({
      ...legacyProfile({ age: 523, weightKg: 9876 }),
      userId: new mongoose.Types.ObjectId(),
      onboardingCompletedAt: new Date(),
    })
    const error = await doc.validate().catch((caught: unknown) => caught as Error)
    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toMatch(/age is out of range/)
    expect(error!.message).not.toContain('523')
    expect(error!.message).not.toContain('9876')
  })

  it('refuses unknown paths (strict) and requires every field', async () => {
    expect(() => new FitnessProfileModel({ userId: new mongoose.Types.ObjectId(), notes: 'x' })).toThrow()
    const error = await new FitnessProfileModel({ userId: new mongoose.Types.ObjectId() }).validate().catch((caught: unknown) => caught as Error)
    expect(error!.message).toMatch(/sex.*required|required/)
  })

  it('stores exactly one of birthYear and age', async () => {
    const base = { userId: new mongoose.Types.ObjectId(), onboardingCompletedAt: new Date() }
    await expect(new FitnessProfileModel({ ...validProfile(), ...base }).validate()).resolves.toBeUndefined()
    await expect(new FitnessProfileModel({ ...legacyProfile(), ...base }).validate()).resolves.toBeUndefined()
    for (const doc of [{ ...validProfile(), age: 29 }, legacyProfile({ age: undefined })]) {
      const error = await new FitnessProfileModel({ ...doc, ...base }).validate().catch((caught: unknown) => caught as Error)
      expect(error!.message).toMatch(/exactly one of birthYear and age is required/)
    }
  })

  it('rejects a non-integer or implausible birth year', async () => {
    const base = { userId: new mongoose.Types.ObjectId(), onboardingCompletedAt: new Date() }
    for (const birthYear of [1990.5, 1800, 3000]) {
      const error = await new FitnessProfileModel({ ...validProfile({ birthYear }), ...base }).validate().catch((caught: unknown) => caught as Error)
      expect(error!.message).toMatch(/birthYear/)
    }
  })
})

describe('toPublicFitnessProfile', () => {
  const stored = (fields: Partial<FitnessProfile>): FitnessProfile => {
    const now = new Date('2026-03-01T00:00:00Z')
    return { ...(validProfile() as unknown as FitnessProfile), _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(), onboardingCompletedAt: now, createdAt: now, updatedAt: now, ...fields }
  }

  it('derives the age from the birth year, so it stays current', () => {
    const profile = stored({ birthYear: 1997, age: undefined })
    expect(toPublicFitnessProfile(profile, new Date('2026-06-01T00:00:00Z'))).toMatchObject({ birthYear: 1997, age: 29 })
    expect(toPublicFitnessProfile(profile, new Date('2027-06-01T00:00:00Z'))).toMatchObject({ birthYear: 1997, age: 30 })
  })

  it('reports a pre-FIT-14 profile with its age as entered and no birth year (nothing estimated)', () => {
    expect(toPublicFitnessProfile(stored({ birthYear: undefined, age: 41 }))).toMatchObject({ birthYear: null, age: 41 })
  })

  it('fails loudly instead of inventing an age for a corrupt document', () => {
    expect(() => toPublicFitnessProfile(stored({ birthYear: undefined, age: undefined }))).toThrow(/neither birthYear nor age/)
  })
})
