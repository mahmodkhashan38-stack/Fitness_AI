import { PROFILE_FIELDS } from '@/constants/fitness-profile'
import { AUTH_REQUEST_TIMEOUT_MS, apiErrorCode, toAuthFormError } from '@/services/api/auth'
import { apiClient } from '@/services/api/client'
import { isApiError } from '@/services/api/errors'
import type { ApiClient } from '@/services/api/types'
import type { AuthFormError } from '@/types/auth'
import type { FitnessGoal, FitnessProfile, FitnessProfileField, FitnessProfileInput, Sex } from '@/types/fitness-profile'

/**
 * The signed-in user's fitness profile (FIT-12). There is no user id anywhere in these calls:
 * the API always uses the session's user.
 */
const PATH = '/users/me/fitness-profile'

const SEXES: readonly Sex[] = ['male', 'female']
const GOALS: readonly FitnessGoal[] = ['muscle_gain', 'fat_loss', 'maintenance', 'general_fitness']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function parseFitnessProfile(value: unknown): FitnessProfile {
  if (!isRecord(value)) throw new TypeError('Unexpected fitness profile payload')
  const { sex, birthYear, age, heightCm, weightKg, goal, trainingDaysPerWeek, onboardingCompletedAt, updatedAt } = value
  if (
    !SEXES.includes(sex as Sex) ||
    !GOALS.includes(goal as FitnessGoal) ||
    // null: a profile saved before FIT-14 that has no birth year yet. Absent: an API from before
    // FIT-14 (only while a deployment is in progress), which is treated the same way.
    !(birthYear === null || birthYear === undefined || isNumber(birthYear)) ||
    !isNumber(age) ||
    !isNumber(heightCm) ||
    !isNumber(weightKg) ||
    !isNumber(trainingDaysPerWeek) ||
    value.onboardingCompleted !== true ||
    typeof onboardingCompletedAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    throw new TypeError('Unexpected fitness profile payload')
  }
  return {
    sex: sex as Sex,
    birthYear: birthYear ?? null,
    age,
    heightCm,
    weightKg,
    goal: goal as FitnessGoal,
    trainingDaysPerWeek,
    onboardingCompleted: true,
    onboardingCompletedAt,
    updatedAt,
  }
}

const parseProfileResponse = (data: unknown): FitnessProfile => {
  if (!isRecord(data)) throw new TypeError('Unexpected response')
  return parseFitnessProfile(data.profile)
}

/** The user's profile, or null if they haven't completed onboarding yet (404). */
export async function getFitnessProfile(options: { signal?: AbortSignal; client?: ApiClient } = {}): Promise<FitnessProfile | null> {
  const client = options.client ?? apiClient
  try {
    return await client.get(PATH, { signal: options.signal, parse: parseProfileResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
  } catch (error) {
    if (apiErrorCode(error) === 'FITNESS_PROFILE_NOT_FOUND') return null
    throw error
  }
}

/** Completes onboarding for an existing account (409 ONBOARDING_ALREADY_COMPLETED if it already has a profile). */
export function completeOnboarding(input: FitnessProfileInput, client: ApiClient = apiClient): Promise<FitnessProfile> {
  return client.post(PATH, { body: input, parse: parseProfileResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
}

/** Sends only the changed fields. */
export function updateFitnessProfile(changes: Partial<FitnessProfileInput>, client: ApiClient = apiClient): Promise<FitnessProfile> {
  return client.patch(PATH, { body: changes, parse: parseProfileResponse, timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
}

/** UI copy for profile form failures; validation messages are shown next to their fields. */
export function toFitnessProfileFormError(error: unknown): AuthFormError<FitnessProfileField> | null {
  if (isApiError(error) && apiErrorCode(error) === 'ONBOARDING_REQUIRED') {
    return { message: 'Complete your fitness profile first.', fields: {} }
  }
  return toAuthFormError<FitnessProfileField>(error, PROFILE_FIELDS)
}
