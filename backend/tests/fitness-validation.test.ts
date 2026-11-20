import { describe, expect, it } from 'vitest'
import { parseFitnessProfile, parseFitnessProfileUpdate, parseOnboarding, PROFILE_FIELDS } from '../src/fitness/validation.js'
import { FitnessProfileModel } from '../src/models/fitness-profile.js'
import { HttpError } from '../src/utils/http-error.js'
import mongoose from 'mongoose'
import { validProfile } from './support/client.js'

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
      validProfile({ age: 16, heightCm: 100, weightKg: 30, trainingDaysPerWeek: 0, sex: 'male', goal: 'fat_loss' }),
      validProfile({ age: 100, heightCm: 250, weightKg: 300, trainingDaysPerWeek: 7, goal: 'maintenance' }),
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
      age: 'Enter your age.',
      heightCm: 'Enter your height in centimeters.',
      weightKg: 'Enter your weight in kilograms.',
      goal: 'Choose your main goal.',
      trainingDaysPerWeek: 'Choose how many days a week you train.',
    })
  })

  it.each([
    ['age', 15, 'Age must be between 16 and 100.'],
    ['age', 101, 'Age must be between 16 and 100.'],
    ['age', 29.5, 'Enter your age in whole years.'],
    ['age', -1, 'Age must be between 16 and 100.'],
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

describe('parseOnboarding', () => {
  it('requires every field', () => {
    expect(parseOnboarding(validProfile())).toEqual(validProfile())
    const error = errorOf(() => parseOnboarding({ sex: 'male' }))
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(error.fields ?? {})).toEqual(['age', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek'])
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

  it('refuses null instead of clearing a mandatory field', () => {
    expect(errorOf(() => parseFitnessProfileUpdate({ age: null })).fields).toEqual({ age: 'Enter your age.' })
  })

  it('reports every invalid field', () => {
    expect(errorOf(() => parseFitnessProfileUpdate({ age: 12, goal: 'x' })).fields).toEqual({
      age: 'Age must be between 16 and 100.',
      goal: 'Choose your main goal.',
    })
  })

  it.each([{ userId: new mongoose.Types.ObjectId().toString() }, { onboardingCompletedAt: '2020-01-01' }, { updatedAt: 'x' }, { $set: { age: 30 } }])(
    'rejects fields outside the whitelist (%j)',
    (body) => {
      expect(errorOf(() => parseFitnessProfileUpdate({ age: 30, ...body })).status).toBe(400)
    },
  )
})

describe('FitnessProfile schema (defence in depth)', () => {
  it('rejects out-of-range values without echoing them in the error message', async () => {
    const doc = new FitnessProfileModel({
      ...validProfile({ age: 523, weightKg: 9876 }),
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
})
