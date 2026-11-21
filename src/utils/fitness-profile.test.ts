import { describe, expect, it } from 'vitest'
import { birthYearFor, LEGACY_PROFILE, TEST_PROFILE } from '@/test/fitness-profile'
import type { FitnessProfileFormValues } from '@/types/fitness-profile'
import {
  birthYearRange,
  changedProfileFields,
  currentYear,
  describeAge,
  describeProfile,
  EMPTY_PROFILE_FORM,
  parseTypedNumber,
  toProfileFormValues,
  toProfileInput,
  validateProfileForm,
} from '@/utils/fitness-profile'

const valid: FitnessProfileFormValues = { sex: 'male', birthYear: String(birthYearFor(35)), heightCm: '180', weightKg: '82.5', goal: 'fat_loss', trainingDaysPerWeek: '3' }

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
    expect(Object.keys(validateProfileForm(EMPTY_PROFILE_FORM))).toEqual(['sex', 'birthYear', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek'])
  })

  it.each([
    [{ birthYear: String(birthYearFor(15)) }, 'birthYear', `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    [{ birthYear: String(birthYearFor(101)) }, 'birthYear', `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    [{ birthYear: '98' }, 'birthYear', `Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`],
    [{ birthYear: '1990.5' }, 'birthYear', 'Enter your birth year as a 4-digit year.'],
    [{ birthYear: 'nineteen' }, 'birthYear', 'Enter your birth year.'],
    [{ birthYear: ' ' }, 'birthYear', 'Enter your birth year.'],
    [{ heightCm: '250.1' }, 'heightCm', 'Height must be between 100 and 250 cm.'],
    [{ weightKg: '29.9' }, 'weightKg', 'Weight must be between 30 and 300 kg.'],
    [{ trainingDaysPerWeek: '8' }, 'trainingDaysPerWeek', 'Choose between 0 and 7 days.'],
    [{ sex: 'other' }, 'sex', 'Select your sex.'],
    [{ goal: 'bulk' }, 'goal', 'Choose your main goal.'],
  ])('%j → %s error', (override, field, message) => {
    expect(validateProfileForm({ ...valid, ...override } as FitnessProfileFormValues)).toEqual({ [field]: message })
  })

  it('accepts the boundaries', () => {
    expect(validateProfileForm({ ...valid, birthYear: String(birthYearFor(16)), heightCm: '100', weightKg: '300', trainingDaysPerWeek: '0' })).toEqual({})
    expect(validateProfileForm({ ...valid, birthYear: String(birthYearFor(100)), heightCm: '250', weightKg: '30', trainingDaysPerWeek: '7' })).toEqual({})
  })

  it('can validate a subset of fields (one wizard step)', () => {
    expect(validateProfileForm(EMPTY_PROFILE_FORM, ['goal'])).toEqual({ goal: 'Choose your main goal.' })
  })

  it('lets a profile saved before FIT-14 leave the birth year blank, but still checks one that is typed', () => {
    const options = { birthYearOptional: true }
    expect(validateProfileForm({ ...valid, birthYear: '' }, undefined, options)).toEqual({})
    expect(validateProfileForm({ ...valid, birthYear: '2030' }, undefined, options)).toHaveProperty('birthYear')
    expect(validateProfileForm({ ...valid, birthYear: '' })).toEqual({ birthYear: 'Enter your birth year.' })
  })
})

describe('birth years (FIT-14)', () => {
  it('uses the UTC year, like the API, and allows ages 16–100 reached this year', () => {
    expect(currentYear(new Date('2026-12-31T23:30:00-02:00'))).toBe(2027)
    expect(birthYearRange(2026)).toEqual({ min: 1926, max: 2010 })
  })

  it('moves the accepted range with the year', () => {
    const values = { ...valid, birthYear: '2010' }
    expect(validateProfileForm(values, ['birthYear'], { year: 2026 })).toEqual({})
    expect(validateProfileForm(values, ['birthYear'], { year: 2025 })).toEqual({ birthYear: 'Birth year must be between 1925 and 2009.' })
  })
})

describe('conversion', () => {
  it('converts to API numbers, rounding measurements to one decimal', () => {
    expect(toProfileInput({ ...valid, heightCm: '180,26', weightKg: '82.44' })).toEqual({
      sex: 'male',
      birthYear: birthYearFor(35),
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
    const { sex, birthYear, heightCm, weightKg, goal, trainingDaysPerWeek } = TEST_PROFILE
    expect(toProfileInput(toProfileFormValues(TEST_PROFILE))).toEqual({ sex, birthYear, heightCm, weightKg, goal, trainingDaysPerWeek })
  })

  it('leaves the birth year blank for a profile saved before FIT-14', () => {
    expect(toProfileFormValues(LEGACY_PROFILE).birthYear).toBe('')
  })

  it('finds only the changed fields', () => {
    const form = toProfileFormValues(TEST_PROFILE)
    expect(changedProfileFields(TEST_PROFILE, { ...form, weightKg: '60' })).toEqual({ weightKg: 60 })
    expect(changedProfileFields(TEST_PROFILE, { ...form, weightKg: '61,5', heightCm: '168.0' })).toEqual({})
    expect(changedProfileFields(TEST_PROFILE, { ...form, birthYear: '1990' })).toEqual({ birthYear: 1990 })
  })

  it('never sends a blank birth year: the stored age is kept until one is added', () => {
    const form = toProfileFormValues(LEGACY_PROFILE)
    expect(changedProfileFields(LEGACY_PROFILE, { ...form, weightKg: '70' })).toEqual({ weightKg: 70 })
    expect(changedProfileFields(LEGACY_PROFILE, { ...form, birthYear: '1985' })).toEqual({ birthYear: 1985 })
  })

  it('describes a profile for people', () => {
    expect(describeProfile({ ...TEST_PROFILE, trainingDaysPerWeek: 1 })).toMatchObject({
      sex: 'Female',
      birthYear: String(birthYearFor(29)),
      heightCm: '168 cm',
      weightKg: '61.5 kg',
      goal: 'Muscle Gain',
      trainingDaysPerWeek: '1 day',
    })
  })

  it('describes the age honestly: derived this year, or as entered', () => {
    expect(describeAge(TEST_PROFILE)).toBe('29 this year')
    expect(describeAge(LEGACY_PROFILE)).toBe('41 years')
    expect(describeProfile(LEGACY_PROFILE).birthYear).toBe('Not added')
  })
})
