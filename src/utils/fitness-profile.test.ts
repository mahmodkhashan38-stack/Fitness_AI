import { describe, expect, it } from 'vitest'
import { TEST_PROFILE } from '@/test/fitness-profile'
import type { FitnessProfileFormValues } from '@/types/fitness-profile'
import {
  changedProfileFields,
  describeProfile,
  EMPTY_PROFILE_FORM,
  parseTypedNumber,
  toProfileFormValues,
  toProfileInput,
  validateProfileForm,
} from '@/utils/fitness-profile'

const valid: FitnessProfileFormValues = { sex: 'male', age: '35', heightCm: '180', weightKg: '82.5', goal: 'fat_loss', trainingDaysPerWeek: '3' }

describe('parseTypedNumber', () => {
  it.each([
    ['72', 72],
    [' 72.5 ', 72.5],
    ['72,5', 72.5],
    ['0', 0],
  ])('%j → %s', (text, value) => {
    expect(parseTypedNumber(text)).toBe(value)
  })

  it.each(['', ' ', 'abc', '-5', '+5', '1e3', '7.2.5', '72,5,1', '0x10', '½', 'Infinity'])('rejects %j', (text) => {
    expect(parseTypedNumber(text)).toBeNull()
  })
})

describe('validateProfileForm (mirrors the API)', () => {
  it('accepts a complete profile', () => {
    expect(validateProfileForm(valid)).toEqual({})
  })

  it('reports every missing field in display order', () => {
    expect(Object.keys(validateProfileForm(EMPTY_PROFILE_FORM))).toEqual(['sex', 'age', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek'])
  })

  it.each([
    [{ age: '15' }, 'age', 'Age must be between 16 and 100.'],
    [{ age: '101' }, 'age', 'Age must be between 16 and 100.'],
    [{ age: '30.5' }, 'age', 'Enter your age in whole years.'],
    [{ heightCm: '250.1' }, 'heightCm', 'Height must be between 100 and 250 cm.'],
    [{ weightKg: '29.9' }, 'weightKg', 'Weight must be between 30 and 300 kg.'],
    [{ trainingDaysPerWeek: '8' }, 'trainingDaysPerWeek', 'Choose between 0 and 7 days.'],
    [{ sex: 'other' }, 'sex', 'Select your sex.'],
    [{ goal: 'bulk' }, 'goal', 'Choose your main goal.'],
  ])('%j → %s error', (override, field, message) => {
    expect(validateProfileForm({ ...valid, ...override } as FitnessProfileFormValues)).toEqual({ [field]: message })
  })

  it('accepts the boundaries', () => {
    expect(validateProfileForm({ ...valid, age: '16', heightCm: '100', weightKg: '300', trainingDaysPerWeek: '0' })).toEqual({})
    expect(validateProfileForm({ ...valid, age: '100', heightCm: '250', weightKg: '30', trainingDaysPerWeek: '7' })).toEqual({})
  })

  it('can validate a subset of fields (one wizard step)', () => {
    expect(validateProfileForm(EMPTY_PROFILE_FORM, ['goal'])).toEqual({ goal: 'Choose your main goal.' })
  })
})

describe('conversion', () => {
  it('converts to API numbers, rounding measurements to one decimal', () => {
    expect(toProfileInput({ ...valid, heightCm: '180,26', weightKg: '82.44' })).toEqual({
      sex: 'male',
      age: 35,
      heightCm: 180.3,
      weightKg: 82.4,
      goal: 'fat_loss',
      trainingDaysPerWeek: 3,
    })
  })

  it('refuses to convert invalid values', () => {
    expect(() => toProfileInput(EMPTY_PROFILE_FORM)).toThrow()
  })

  it('round-trips a stored profile through the form', () => {
    const { sex, age, heightCm, weightKg, goal, trainingDaysPerWeek } = TEST_PROFILE
    expect(toProfileInput(toProfileFormValues(TEST_PROFILE))).toEqual({ sex, age, heightCm, weightKg, goal, trainingDaysPerWeek })
  })

  it('finds only the changed fields', () => {
    expect(changedProfileFields(TEST_PROFILE, { ...TEST_PROFILE, weightKg: 60 })).toEqual({ weightKg: 60 })
    expect(changedProfileFields(TEST_PROFILE, TEST_PROFILE)).toEqual({})
  })

  it('describes a profile for people', () => {
    expect(describeProfile({ ...TEST_PROFILE, trainingDaysPerWeek: 1 })).toMatchObject({
      sex: 'Female',
      age: '29 years',
      heightCm: '168 cm',
      weightKg: '61.5 kg',
      goal: 'Muscle Gain',
      trainingDaysPerWeek: '1 day',
    })
  })
})
