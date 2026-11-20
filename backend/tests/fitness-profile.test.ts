import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { hashPassword } from '../src/auth/password.js'
import { supportsTransactions } from '../src/database/connection.js'
import { FitnessProfileModel } from '../src/models/fitness-profile.js'
import { SessionModel } from '../src/models/session.js'
import { UserModel } from '../src/models/user.js'
import type { Logger } from '../src/utils/logger.js'
import { createClient, validProfile, validRegistration, type TestClient } from './support/client.js'
import { startTestDatabase } from './support/mongo.js'
import { startTestApp, type RunningServer } from './helpers.js'

const generous = { windowMs: 60_000, limit: 10_000 }
const noAuthLimits = { register: generous, loginPerIp: generous, loginPerEmail: generous }
const PROFILE_PATH = '/api/users/me/fitness-profile'
const PASSWORD = 'correct horse battery staple'

/** Records everything the API logs, to prove no personal data ends up there. */
const logLines: string[] = []
const capturingLogger: Logger = {
  debug: (message, fields) => logLines.push(JSON.stringify({ message, fields })),
  info: (message, fields) => logLines.push(JSON.stringify({ message, fields })),
  warn: (message, fields) => logLines.push(JSON.stringify({ message, fields })),
  error: (message, fields) =>
    logLines.push(JSON.stringify({ message, fields }, (_key, value: unknown) => (value instanceof Error ? { message: value.message, stack: value.stack } : value))),
}

let db: Awaited<ReturnType<typeof startTestDatabase>>
let running: RunningServer

beforeAll(async () => {
  db = await startTestDatabase()
  running = await startTestApp({ authRateLimits: noAuthLimits, rateLimit: generous, logger: capturingLogger })
})
afterAll(async () => {
  await running.close()
  await db.stop()
})
afterEach(async () => {
  vi.restoreAllMocks()
  logLines.length = 0
  await db.clear()
})

type Profile = {
  sex: string
  age: number
  heightCm: number
  weightKg: number
  goal: string
  trainingDaysPerWeek: number
  onboardingCompleted: boolean
  onboardingCompletedAt: string
  updatedAt: string
}
type ProfileBody = { profile: Profile }
type UserBody = { user: { id: string; email: string; onboardingCompleted: boolean } }
type ErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } }

async function registered(overrides: Record<string, unknown> = {}): Promise<TestClient> {
  const client = createClient(running.url)
  const response = await client.post('/api/auth/register', validRegistration(overrides))
  expect(response.status).toBe(201)
  return client
}

/** An account created before FIT-12: a user document without a fitness profile. */
async function legacyUser(email = 'legacy@example.com') {
  return UserModel.create({ email, name: 'Legacy', passwordHash: await hashPassword(PASSWORD) })
}

async function loggedIn(email: string): Promise<{ client: TestClient; user: UserBody['user'] }> {
  const client = createClient(running.url)
  const response = await client.post<UserBody>('/api/auth/login', { email, password: PASSWORD })
  expect(response.status).toBe(200)
  return { client, user: response.body.user }
}

describe('test database', () => {
  it('is a replica set, like Atlas, so transactions really run', async () => {
    expect(await supportsTransactions()).toBe(true)
  })
})

describe('registration with mandatory onboarding', () => {
  it('creates the user and the profile together and reports onboarding as complete', async () => {
    const client = createClient(running.url)
    const response = await client.post<UserBody>('/api/auth/register', validRegistration())
    expect(response.status).toBe(201)
    expect(response.body.user.onboardingCompleted).toBe(true)

    const user = await UserModel.findOne({ email: 'alex@example.com' }).lean()
    const profiles = await FitnessProfileModel.find().lean()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({ ...validProfile(), userId: user!._id })
    expect(profiles[0]!.onboardingCompletedAt).toBeInstanceOf(Date)

    const me = await client.get<UserBody>('/api/auth/me')
    expect(me.body.user.onboardingCompleted).toBe(true)
  })

  it('returns the profile through the API without internal ids', async () => {
    const client = await registered()
    const response = await client.get<ProfileBody>(PROFILE_PATH)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.body).toEqual({
      profile: {
        ...validProfile(),
        onboardingCompleted: true,
        onboardingCompletedAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    })
    expect(JSON.stringify(response.body)).not.toMatch(/userId|_id|__v|email|password/)
  })

  it('refuses an account without a profile and writes nothing', async () => {
    const client = createClient(running.url)
    const withoutProfile: Record<string, unknown> = validRegistration()
    delete withoutProfile.profile
    const response = await client.post<ErrorBody>('/api/auth/register', withoutProfile)
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.error.fields ?? {}).sort()).toEqual(['age', 'goal', 'heightCm', 'sex', 'trainingDaysPerWeek', 'weightKg'])
    expect(response.setCookies).toEqual([])
    expect(await UserModel.countDocuments()).toBe(0)
    expect(await FitnessProfileModel.countDocuments()).toBe(0)
  })

  it.each([
    ['sex', 'other'],
    ['age', 15],
    ['age', 101],
    ['age', '30'],
    ['heightCm', 99],
    ['heightCm', 251],
    ['weightKg', 29],
    ['weightKg', 301],
    ['goal', 'bulk'],
    ['trainingDaysPerWeek', 8],
    ['trainingDaysPerWeek', -1],
    ['trainingDaysPerWeek', 2.5],
  ])('refuses %s = %j with a field error and creates no account', async (field, value) => {
    const client = createClient(running.url)
    const response = await client.post<ErrorBody>('/api/auth/register', validRegistration({ profile: validProfile({ [field]: value }) }))
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(response.body.error.fields ?? {})).toEqual([field])
    // Messages never echo the submitted value.
    expect(JSON.stringify([response.body.error.message, response.body.error.fields])).not.toContain(String(value))
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('reports account and profile problems together', async () => {
    const response = await createClient(running.url).post<ErrorBody>(
      '/api/auth/register',
      validRegistration({ email: 'nope', profile: validProfile({ age: 3 }) }),
    )
    expect(Object.keys(response.body.error.fields ?? {}).sort()).toEqual(['age', 'email'])
  })

  it('rejects a client-supplied userId inside the profile', async () => {
    const response = await createClient(running.url).post<ErrorBody>(
      '/api/auth/register',
      validRegistration({ profile: { ...validProfile(), userId: new mongoose.Types.ObjectId().toString() } }),
    )
    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Unexpected field: userId.')
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('a duplicate email creates neither a second user nor a second profile', async () => {
    await registered()
    const response = await createClient(running.url).post<ErrorBody>(
      '/api/auth/register',
      validRegistration({ email: 'ALEX@example.com', profile: validProfile({ sex: 'male', age: 50 }) }),
    )
    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('EMAIL_TAKEN')
    expect(await UserModel.countDocuments()).toBe(1)
    const profiles = await FitnessProfileModel.find().lean()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({ sex: 'female', age: 29 })
  })

  it('concurrent registrations with one email leave exactly one consistent account', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 5 }, () => createClient(running.url).post('/api/auth/register', validRegistration()).then((r) => r.status)),
    )
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(4)
    const [users, profiles] = await Promise.all([UserModel.find().lean(), FitnessProfileModel.find().lean()])
    expect(users).toHaveLength(1)
    expect(profiles).toHaveLength(1)
    expect(profiles[0]!.userId.equals(users[0]!._id)).toBe(true)
  })
})

describe('registration failure and recovery (transaction)', () => {
  it('rolls the user back when writing the profile fails, and a retry then succeeds', async () => {
    // Fails after the user has been inserted inside the transaction.
    vi.spyOn(FitnessProfileModel, 'create').mockRejectedValueOnce(new Error('simulated database failure'))
    const client = createClient(running.url)
    const failed = await client.post<ErrorBody>('/api/auth/register', validRegistration())

    expect(failed.status).toBe(500)
    expect(failed.body.error.code).toBe('INTERNAL_ERROR')
    expect(failed.setCookies).toEqual([])
    expect(await UserModel.countDocuments()).toBe(0)
    expect(await FitnessProfileModel.countDocuments()).toBe(0)
    expect(await SessionModel.countDocuments()).toBe(0)

    // The error is logged without the request's personal data.
    const log = logLines.join('\n')
    expect(log).toContain('simulated database failure')
    for (const secret of ['alex@example.com', PASSWORD, '61.5', 'muscle_gain', '"age"']) expect(log).not.toContain(secret)

    const retried = await client.post<UserBody>('/api/auth/register', validRegistration())
    expect(retried.status).toBe(201)
    expect(await UserModel.countDocuments()).toBe(1)
    expect(await FitnessProfileModel.countDocuments()).toBe(1)
  })

  it('retries a transient transaction error (e.g. write conflict) and commits exactly once', async () => {
    const transient = new mongoose.mongo.MongoServerError({ message: 'simulated write conflict', code: 112, errorLabels: ['TransientTransactionError'] })
    const create = FitnessProfileModel.create.bind(FitnessProfileModel)
    let calls = 0
    vi.spyOn(FitnessProfileModel, 'create').mockImplementation(((...args: Parameters<typeof create>) => {
      calls += 1
      if (calls === 1) return Promise.reject(transient)
      return create(...args)
    }) as typeof create)

    const response = await createClient(running.url).post<UserBody>('/api/auth/register', validRegistration())
    expect(response.status).toBe(201)
    expect(calls).toBe(2)
    expect(await UserModel.countDocuments()).toBe(1)
    expect(await FitnessProfileModel.countDocuments()).toBe(1)
  })

  it('a failure while creating the session after commit leaves a complete account that can log in', async () => {
    vi.spyOn(SessionModel, 'create').mockRejectedValueOnce(new Error('simulated session failure'))
    const failed = await createClient(running.url).post('/api/auth/register', validRegistration())
    expect(failed.status).toBe(500)
    expect(await UserModel.countDocuments()).toBe(1)
    expect(await FitnessProfileModel.countDocuments()).toBe(1)
    const { user } = await loggedIn('alex@example.com')
    expect(user.onboardingCompleted).toBe(true)
  })
})

describe('existing users without a profile (accounts created before FIT-12)', () => {
  it('can still log in and are told onboarding is pending', async () => {
    await legacyUser()
    const { client, user } = await loggedIn('legacy@example.com')
    expect(user.onboardingCompleted).toBe(false)
    expect((await client.get<UserBody>('/api/auth/me')).body.user.onboardingCompleted).toBe(false)
    const profile = await client.get<ErrorBody>(PROFILE_PATH)
    expect(profile.status).toBe(404)
    expect(profile.body.error.code).toBe('FITNESS_PROFILE_NOT_FOUND')
  })

  it('cannot update a profile before completing onboarding', async () => {
    await legacyUser()
    const { client } = await loggedIn('legacy@example.com')
    const response = await client.patch<ErrorBody>(PROFILE_PATH, { weightKg: 80 })
    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('ONBOARDING_REQUIRED')
    expect(await FitnessProfileModel.countDocuments()).toBe(0)
  })

  it('complete onboarding once; existing sessions stay valid and see the new state', async () => {
    const user = await legacyUser()
    const phone = (await loggedIn('legacy@example.com')).client
    const laptop = (await loggedIn('legacy@example.com')).client

    const created = await phone.post<ProfileBody>(PROFILE_PATH, validProfile({ goal: 'fat_loss' }))
    expect(created.status).toBe(201)
    expect(created.body.profile).toMatchObject({ goal: 'fat_loss', onboardingCompleted: true })

    // The other session was not touched and now reports onboarding as complete.
    expect((await laptop.get<UserBody>('/api/auth/me')).body.user.onboardingCompleted).toBe(true)
    expect(await SessionModel.countDocuments({ userId: user._id })).toBe(2)

    const again = await laptop.post<ErrorBody>(PROFILE_PATH, validProfile({ goal: 'maintenance' }))
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ONBOARDING_ALREADY_COMPLETED')
    expect((await FitnessProfileModel.findOne({ userId: user._id }).lean())!.goal).toBe('fat_loss')
  })

  it('concurrent onboarding requests create exactly one profile', async () => {
    await legacyUser()
    const { client } = await loggedIn('legacy@example.com')
    const statuses = await Promise.all(Array.from({ length: 5 }, () => client.post(PROFILE_PATH, validProfile()).then((r) => r.status)))
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(4)
    expect(await FitnessProfileModel.countDocuments()).toBe(1)
  })

  it('onboarding validates every field and writes nothing on error', async () => {
    await legacyUser()
    const { client } = await loggedIn('legacy@example.com')
    const response = await client.post<ErrorBody>(PROFILE_PATH, { sex: 'female', age: 200 })
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.error.fields ?? {})).toEqual(['age', 'heightCm', 'weightKg', 'goal', 'trainingDaysPerWeek'])
    expect(await FitnessProfileModel.countDocuments()).toBe(0)
  })
})

describe('profile updates', () => {
  it('changes only the submitted fields and keeps the onboarding date', async () => {
    const client = await registered()
    const before = (await client.get<ProfileBody>(PROFILE_PATH)).body.profile
    await new Promise((resolve) => setTimeout(resolve, 5))

    const response = await client.patch<ProfileBody>(PROFILE_PATH, { weightKg: 63.25, trainingDaysPerWeek: 5 })
    expect(response.status).toBe(200)
    expect(response.body.profile).toEqual({
      ...before,
      weightKg: 63.3,
      trainingDaysPerWeek: 5,
      updatedAt: expect.any(String),
    })
    expect(response.body.profile.onboardingCompletedAt).toBe(before.onboardingCompletedAt)
    expect(Date.parse(response.body.profile.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt))
    expect((await client.get<ProfileBody>(PROFILE_PATH)).body.profile.weightKg).toBe(63.3)
  })

  it.each([
    [{}, undefined],
    [{ age: 12 }, 'age'],
    [{ sex: 'unknown' }, 'sex'],
    [{ heightCm: '180' }, 'heightCm'],
    [{ trainingDaysPerWeek: null }, 'trainingDaysPerWeek'],
  ])('rejects invalid updates %j and changes nothing', async (body, field) => {
    const client = await registered()
    const response = await client.patch<ErrorBody>(PROFILE_PATH, body)
    expect(response.status).toBe(400)
    if (field) expect(Object.keys(response.body.error.fields ?? {})).toEqual([field])
    expect(await FitnessProfileModel.findOne().lean()).toMatchObject(validProfile())
  })

  it.each([{ userId: 'x' }, { onboardingCompletedAt: '2020-01-01T00:00:00Z' }, { _id: 'x' }, { email: 'x@y.z' }])(
    'rejects attempts to change protected fields %j',
    async (extra) => {
      const client = await registered()
      const response = await client.patch<ErrorBody>(PROFILE_PATH, { age: 40, ...extra })
      expect(response.status).toBe(400)
      expect(await FitnessProfileModel.findOne().lean()).toMatchObject({ age: 29 })
    },
  )

  it('offers no PUT or DELETE', async () => {
    const client = await registered()
    expect((await client.put(PROFILE_PATH, validProfile())).status).toBe(404)
    expect((await client.delete(PROFILE_PATH)).status).toBe(404)
    expect(await FitnessProfileModel.countDocuments()).toBe(1)
  })
})

describe('authentication and authorisation', () => {
  it.each(['GET', 'POST', 'PATCH'])('%s without a session is 401', async (method) => {
    const response = await createClient(running.url).request<ErrorBody>(method, PROFILE_PATH, {
      json: method === 'GET' ? undefined : validProfile(),
    })
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('a forged or ended session is 401', async () => {
    const forged = createClient(running.url)
    forged.jar.set('fa_session', 'A'.repeat(43))
    expect((await forged.get(PROFILE_PATH)).status).toBe(401)

    const client = await registered()
    await client.post('/api/auth/logout')
    expect((await client.get(PROFILE_PATH)).status).toBe(401)
  })

  it('keeps CSRF protection: foreign or missing Origin and non-JSON bodies are refused', async () => {
    const client = await registered()
    expect((await client.patch(PROFILE_PATH, { age: 40 }, { Origin: 'https://evil.example' })).status).toBe(403)
    const cookie = [...client.jar].map(([name, value]) => `${name}=${value}`).join('; ')
    const noOrigin = createClient(running.url, { origin: null })
    expect((await noOrigin.request('PATCH', PROFILE_PATH, { json: { age: 40 }, headers: { Cookie: cookie } })).status).toBe(403)
    expect((await client.request('PATCH', PROFILE_PATH, { rawBody: 'age=40', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status).toBe(415)
    expect(await FitnessProfileModel.findOne().lean()).toMatchObject({ age: 29 })
  })
})

describe('cross-user isolation', () => {
  it('each user only ever sees and changes their own profile', async () => {
    const alex = await registered({ email: 'alex@example.com', profile: validProfile({ sex: 'female', age: 29 }) })
    const sam = await registered({ email: 'sam@example.com', profile: validProfile({ sex: 'male', age: 41, goal: 'fat_loss' }) })
    const samUser = await UserModel.findOne({ email: 'sam@example.com' }).lean()
    const samId = samUser!._id.toString()

    expect((await alex.get<ProfileBody>(PROFILE_PATH)).body.profile).toMatchObject({ sex: 'female', age: 29 })
    expect((await sam.get<ProfileBody>(PROFILE_PATH)).body.profile).toMatchObject({ sex: 'male', age: 41 })

    // A user id in the query string, body or path is never used.
    expect((await alex.get<ProfileBody>(`${PROFILE_PATH}?userId=${samId}`)).body.profile).toMatchObject({ age: 29 })
    expect((await alex.patch(PROFILE_PATH, { age: 30, userId: samId })).status).toBe(400)
    expect((await alex.get(`/api/users/${samId}/fitness-profile`)).status).toBe(404)
    expect((await alex.patch(`/api/users/${samId}/fitness-profile`, { age: 99 })).status).toBe(404)

    expect((await alex.patch<ProfileBody>(PROFILE_PATH, { age: 30 })).body.profile.age).toBe(30)
    expect(await FitnessProfileModel.findOne({ userId: samUser!._id }).lean()).toMatchObject({ age: 41, goal: 'fat_loss' })
  })

  it('onboarding never attaches a profile to another account', async () => {
    const legacy = await legacyUser()
    const other = await legacyUser('other@example.com')
    const { client } = await loggedIn('legacy@example.com')
    expect((await client.post(PROFILE_PATH, { ...validProfile(), userId: other._id.toString() })).status).toBe(400)
    expect((await client.post(PROFILE_PATH, validProfile())).status).toBe(201)
    expect(await FitnessProfileModel.countDocuments({ userId: other._id })).toBe(0)
    expect(await FitnessProfileModel.countDocuments({ userId: legacy._id })).toBe(1)
  })
})

describe('sessions (FIT-11 behaviour preserved)', () => {
  it('a new login reports onboarding as complete and sees the same profile', async () => {
    await registered()
    const { client, user } = await loggedIn('alex@example.com')
    expect(user.onboardingCompleted).toBe(true)
    expect((await client.get<ProfileBody>(PROFILE_PATH)).body.profile).toMatchObject(validProfile())
  })

  it('updating the account name keeps the onboarding flag', async () => {
    const client = await registered()
    const response = await client.patch<UserBody>('/api/users/me', { name: 'Alexandra' })
    expect(response.body.user).toMatchObject({ name: 'Alexandra', onboardingCompleted: true })
  })
})
