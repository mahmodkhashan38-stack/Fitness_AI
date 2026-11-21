import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/errors'
import {
  completeOnboarding,
  getFitnessProfile,
  parseFitnessProfile,
  toFitnessProfileFormError,
  updateFitnessProfile,
} from '@/services/api/fitness-profile'
import { LEGACY_PROFILE, TEST_PROFILE, TEST_PROFILE_INPUT } from '@/test/fitness-profile'

const json = (body: unknown, status = 200) => Response.json(body, { status })
const httpError = (status: number, body: unknown) => new ApiError({ kind: 'http', status, body, message: 'x' })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('fitness profile API', () => {
  it('reads the own profile from /users/me (never a user id)', async () => {
    fetchMock.mockResolvedValueOnce(json({ profile: TEST_PROFILE }))
    expect(await getFitnessProfile()).toEqual(TEST_PROFILE)
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/users/me/fitness-profile')
  })

  it('returns null when onboarding is not complete (404)', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'FITNESS_PROFILE_NOT_FOUND', message: 'x' } }, 404))
    expect(await getFitnessProfile()).toBeNull()
  })

  it('throws other failures', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'UNAUTHENTICATED' } }, 401))
    await expect(getFitnessProfile()).rejects.toMatchObject({ kind: 'http', status: 401 })
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'NOT_FOUND' } }, 404))
    await expect(getFitnessProfile()).rejects.toMatchObject({ status: 404 })
  })

  it('completes onboarding with POST and updates with PATCH of only the given fields', async () => {
    fetchMock.mockImplementation(async () => json({ profile: TEST_PROFILE }, 201))
    await completeOnboarding(TEST_PROFILE_INPUT)
    await updateFitnessProfile({ weightKg: 60 })
    const [postUrl, post] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [patchUrl, patch] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect([postUrl, post.method, JSON.parse(post.body as string)]).toEqual(['/api/users/me/fitness-profile', 'POST', TEST_PROFILE_INPUT])
    expect([patchUrl, patch.method, JSON.parse(patch.body as string)]).toEqual(['/api/users/me/fitness-profile', 'PATCH', { weightKg: 60 }])
  })

  it.each([
    { ...TEST_PROFILE, sex: 'other' },
    { ...TEST_PROFILE, goal: 'bulk' },
    { ...TEST_PROFILE, age: '29' },
    { ...TEST_PROFILE, age: undefined },
    { ...TEST_PROFILE, birthYear: '1997' },
    { ...TEST_PROFILE, onboardingCompleted: false },
    { ...TEST_PROFILE, updatedAt: undefined },
    null,
  ])('rejects a malformed profile payload %#', (payload) => {
    expect(() => parseFitnessProfile(payload)).toThrow()
  })

  it('accepts a profile saved before FIT-14: no birth year yet, the age as entered', () => {
    expect(parseFitnessProfile(LEGACY_PROFILE)).toEqual(LEGACY_PROFILE)
  })

  it('reads a response from a pre-FIT-14 API (no birthYear, during a deployment) as a profile without one', () => {
    const withoutBirthYear: Record<string, unknown> = { ...LEGACY_PROFILE }
    delete withoutBirthYear.birthYear
    expect(parseFitnessProfile(withoutBirthYear)).toEqual(LEGACY_PROFILE)
  })

  it('drops unexpected fields from the payload', () => {
    expect(parseFitnessProfile({ ...TEST_PROFILE, userId: 'x' })).toEqual(TEST_PROFILE)
  })
})

describe('toFitnessProfileFormError', () => {
  it('keeps profile field messages and ignores unknown fields', () => {
    expect(
      toFitnessProfileFormError(httpError(400, { error: { code: 'VALIDATION_FAILED', fields: { birthYear: 'Birth year must be between 1926 and 2010.', age: 'x', userId: 'x' } } })),
    ).toEqual({ message: null, fields: { birthYear: 'Birth year must be between 1926 and 2010.' } })
  })

  it.each([
    [httpError(409, { error: { code: 'ONBOARDING_REQUIRED' } }), 'Complete your fitness profile first.'],
    [httpError(401, { error: { code: 'UNAUTHENTICATED' } }), 'Your session has ended. Please log in again.'],
    [httpError(403, { error: { code: 'CSRF_REJECTED' } }), 'Your request was blocked for security reasons. Reload the page and try again.'],
    [new ApiError({ kind: 'network', message: 'x' }), 'Can’t reach Fitness AI. Check your connection and try again.'],
  ])('maps %#', (error, message) => {
    expect(toFitnessProfileFormError(error)?.message).toBe(message)
  })
})
