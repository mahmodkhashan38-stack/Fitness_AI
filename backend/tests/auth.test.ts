import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SESSION_TTL_MS } from '../src/auth/cookies.js'
import { hashSessionToken } from '../src/auth/session-token.js'
import { SessionModel } from '../src/models/session.js'
import { UserModel } from '../src/models/user.js'
import { createClient, validRegistration, type TestClient } from './support/client.js'
import { startTestDatabase } from './support/mongo.js'
import { startTestApp, type RunningServer } from './helpers.js'

// Rate limits are covered in auth-security.test.ts; here they must not interfere.
const generous = { windowMs: 60_000, limit: 10_000 }
const noAuthLimits = { register: generous, loginPerIp: generous, loginPerEmail: generous }

let db: Awaited<ReturnType<typeof startTestDatabase>>
let running: RunningServer
let client: TestClient

beforeAll(async () => {
  db = await startTestDatabase()
  running = await startTestApp({ authRateLimits: noAuthLimits, rateLimit: generous })
})
afterAll(async () => {
  await running.close()
  await db.stop()
})
afterEach(async () => {
  await db.clear()
})

const fresh = () => (client = createClient(running.url))
const sessionCookie = (c: TestClient) => c.jar.get('fa_session')

type UserBody = { user: { id: string; email: string; name: string; createdAt: string } }
type ErrorBody = { error: { code: string; message: string; fields?: Record<string, string>; requestId: string } }

describe('registration', () => {
  it('creates the account, signs the user in and returns only public fields', async () => {
    fresh()
    const response = await client.post<UserBody>('/api/auth/register', validRegistration({ email: '  Alex@Example.COM ' }))

    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      user: { id: expect.stringMatching(/^[0-9a-f]{24}$/), email: 'alex@example.com', name: 'Alex', createdAt: expect.any(String) },
    })
    expect(JSON.stringify(response.body)).not.toMatch(/password|hash|_id|__v/i)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('sets an HttpOnly, SameSite=Strict session cookie for the whole site, valid for 14 days', async () => {
    fresh()
    const response = await client.post('/api/auth/register', validRegistration())
    expect(response.setCookies).toHaveLength(1)
    const cookie = response.setCookies[0]!
    expect(cookie).toMatch(/^fa_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toMatch(/; HttpOnly/i)
    expect(cookie).toMatch(/; SameSite=Strict/i)
    expect(cookie).toMatch(/; Path=\//)
    expect(cookie).toMatch(new RegExp(`; Max-Age=${SESSION_TTL_MS / 1000}`))
    expect(cookie).not.toMatch(/Domain=/i)
  })

  it('stores an Argon2id hash, never the password, and only the hash of the session token', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    const stored = await UserModel.findOne({ email: 'alex@example.com' }).select('+passwordHash').lean()
    expect(stored!.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(stored!.passwordHash).not.toContain('correct horse')

    const token = sessionCookie(client)!
    const sessions = await SessionModel.find().lean()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.tokenHash).toBe(hashSessionToken(token))
    expect(JSON.stringify(sessions)).not.toContain(token)
  })

  it.each([
    [{}, ['email', 'password', 'name']],
    [validRegistration({ email: 'not-an-email' }), ['email']],
    [validRegistration({ password: 'short' }), ['password']],
    [validRegistration({ password: 'x'.repeat(129) }), ['password']],
    [validRegistration({ password: 'alex@example.com' }), ['password']],
    [validRegistration({ name: '   ' }), ['name']],
    [validRegistration({ name: 'n'.repeat(61) }), ['name']],
    [validRegistration({ email: 42 }), ['email']],
  ])('rejects invalid input %#', async (body, fields) => {
    fresh()
    const response = await client.post<ErrorBody>('/api/auth/register', body)
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(response.body.error.fields ?? {}).sort()).toEqual([...fields].sort())
    expect(response.setCookies).toEqual([])
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('rejects extra fields such as role or id (no mass assignment)', async () => {
    fresh()
    for (const extra of [{ role: 'admin' }, { id: new mongoose.Types.ObjectId().toString() }, { passwordHash: 'x' }]) {
      const response = await client.post<ErrorBody>('/api/auth/register', { ...validRegistration(), ...extra })
      expect(response.status).toBe(400)
      expect(response.body.error.message).toMatch(/Unexpected field/)
    }
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('accepts long passphrases with any characters, without truncation', async () => {
    fresh()
    // 100 code points (~110 UTF-16 units, within the 128 limit), cut by code point so emoji stay intact.
    const codePoints = Array.from('Ünïcödé pässphrase 💪 '.repeat(10)).slice(0, 100)
    const password = codePoints.join('')
    const withoutLastCharacter = codePoints.slice(0, -1).join('')
    expect(password.length).toBeGreaterThan(100)
    expect(password.length).toBeLessThanOrEqual(128)

    expect((await client.post('/api/auth/register', validRegistration({ password }))).status).toBe(201)
    const other = createClient(running.url)
    expect((await other.post('/api/auth/login', { email: 'alex@example.com', password })).status).toBe(200)
    expect((await other.post('/api/auth/login', { email: 'alex@example.com', password: withoutLastCharacter })).status).toBe(401)
  })
})

describe('duplicate accounts', () => {
  it('returns 409 EMAIL_TAKEN for an existing email, regardless of case', async () => {
    await createClient(running.url).post('/api/auth/register', validRegistration())
    fresh()
    const response = await client.post<ErrorBody>('/api/auth/register', validRegistration({ email: 'ALEX@example.com', name: 'Other' }))
    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('EMAIL_TAKEN')
    expect(response.setCookies).toEqual([])
    expect(await UserModel.countDocuments()).toBe(1)
  })

  it('creates exactly one account when registrations for the same email race', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 5 }, () => createClient(running.url).post('/api/auth/register', validRegistration()).then((r) => r.status)),
    )
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(4)
    expect(await UserModel.countDocuments()).toBe(1)
  })
})

describe('login', () => {
  const credentials = { email: 'alex@example.com', password: 'correct horse battery staple' }

  it('signs in with the right password (email case-insensitive) and issues a new session', async () => {
    const registered = createClient(running.url)
    await registered.post('/api/auth/register', validRegistration())

    fresh()
    const response = await client.post<UserBody>('/api/auth/login', { ...credentials, email: 'ALEX@EXAMPLE.COM' })
    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe('alex@example.com')
    expect(sessionCookie(client)).not.toBe(sessionCookie(registered))
    expect(await SessionModel.countDocuments()).toBe(2) // one per device
  })

  it('replaces a session cookie that existed before login (session fixation)', async () => {
    await createClient(running.url).post('/api/auth/register', validRegistration())
    fresh()
    await client.post('/api/auth/login', credentials)
    const before = sessionCookie(client)!
    await client.post('/api/auth/login', credentials)
    expect(sessionCookie(client)).not.toBe(before)
    expect(await SessionModel.exists({ tokenHash: hashSessionToken(before) })).toBeNull()
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await createClient(running.url).post('/api/auth/register', validRegistration())
    const wrongPassword = await createClient(running.url).post<ErrorBody>('/api/auth/login', { ...credentials, password: 'wrong password!!' })
    const unknownEmail = await createClient(running.url).post<ErrorBody>('/api/auth/login', { ...credentials, email: 'nobody@example.com' })

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401)
      expect(response.setCookies).toEqual([])
    }
    const withoutRequestId = ({ code, message, fields }: ErrorBody['error']) => ({ code, message, fields })
    const first = withoutRequestId(wrongPassword.body.error)
    expect(first).toEqual(withoutRequestId(unknownEmail.body.error))
    expect(first).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.', fields: undefined })
  })

  it('spends comparable time on unknown emails and wrong passwords (no timing oracle)', async () => {
    await createClient(running.url).post('/api/auth/register', validRegistration())
    const time = async (body: object) => {
      const started = performance.now()
      await createClient(running.url).post('/api/auth/login', body)
      return performance.now() - started
    }
    const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!
    const wrong: number[] = []
    const unknown: number[] = []
    for (let i = 0; i < 5; i++) {
      wrong.push(await time({ ...credentials, password: 'wrong password!!' }))
      unknown.push(await time({ ...credentials, email: `nobody${i}@example.com` }))
    }
    // Both run a full Argon2id verification; without the dummy hash, unknown emails return in ~1 ms.
    expect(median(unknown)).toBeGreaterThan(median(wrong) * 0.5)
  })

  it('treats malformed or oversized credentials as plain wrong credentials', async () => {
    await createClient(running.url).post('/api/auth/register', validRegistration())
    for (const body of [{ email: 'not-an-email', password: 'whatever' }, { ...credentials, password: 'x'.repeat(5000) }]) {
      const response = await createClient(running.url).post<ErrorBody>('/api/auth/login', body)
      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
    }
  })

  it('requires both fields', async () => {
    const response = await createClient(running.url).post<ErrorBody>('/api/auth/login', { email: '' })
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.error.fields!).sort()).toEqual(['email', 'password'])
  })
})

describe('current user and session persistence', () => {
  it('returns the signed-in user and 401 without a session', async () => {
    fresh()
    expect((await client.get<ErrorBody>('/api/auth/me')).body.error.code).toBe('UNAUTHENTICATED')
    await client.post('/api/auth/register', validRegistration())
    const me = await client.get<UserBody>('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.user).toMatchObject({ email: 'alex@example.com', name: 'Alex' })
    expect(me.headers.get('cache-control')).toBe('no-store')
  })

  it('keeps the session across page reloads and API restarts (server-side session, cookie in the browser)', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    const cookie = `fa_session=${sessionCookie(client)}`

    // "Reload": a brand-new client that only has the cookie.
    expect((await createClient(running.url).get('/api/auth/me', { Cookie: cookie })).status).toBe(200)

    // "Render restart": a new app instance on the same database.
    const restarted = await startTestApp({ authRateLimits: noAuthLimits })
    try {
      expect((await createClient(restarted.url).get('/api/auth/me', { Cookie: cookie })).status).toBe(200)
    } finally {
      await restarted.close()
    }
  })

  it.each([
    ['a forged token', 'fa_session=' + 'A'.repeat(43)],
    ['a malformed token', 'fa_session=../../etc/passwd'],
    ['a token under the wrong cookie name', '__Host-fa_session=' + 'A'.repeat(43)],
  ])('rejects %s', async (_label, cookie) => {
    expect((await createClient(running.url).get('/api/auth/me', { Cookie: cookie })).status).toBe(401)
  })

  it('rejects an expired session even before MongoDB removes it', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    await SessionModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    expect((await client.get('/api/auth/me')).status).toBe(401)
  })

  it('rejects the session of a deleted user and removes it', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    await UserModel.deleteMany({})
    expect((await client.get('/api/auth/me')).status).toBe(401)
    expect(await SessionModel.countDocuments()).toBe(0)
  })
})

describe('logout', () => {
  it('deletes the session on the server and clears the cookie', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    const token = sessionCookie(client)!

    const response = await client.post('/api/auth/logout')
    expect(response.status).toBe(204)
    expect(response.setCookies[0]).toMatch(/^fa_session=;.*Expires=Thu, 01 Jan 1970/i)
    expect(response.setCookies[0]).toMatch(/HttpOnly/i)
    expect(await SessionModel.exists({ tokenHash: hashSessionToken(token) })).toBeNull()
    expect((await client.get('/api/auth/me')).status).toBe(401)
  })

  it('invalidates the token server-side, so a copied cookie stops working', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    const stolen = `fa_session=${sessionCookie(client)}`
    await client.post('/api/auth/logout')
    expect((await createClient(running.url).get('/api/auth/me', { Cookie: stolen })).status).toBe(401)
  })

  it('only ends the current device’s session', async () => {
    const phone = createClient(running.url)
    await phone.post('/api/auth/register', validRegistration())
    const laptop = createClient(running.url)
    await laptop.post('/api/auth/login', { email: 'alex@example.com', password: 'correct horse battery staple' })

    await phone.post('/api/auth/logout')
    expect((await phone.get('/api/auth/me')).status).toBe(401)
    expect((await laptop.get('/api/auth/me')).status).toBe(200)
  })

  it('succeeds without a session (idempotent)', async () => {
    expect((await createClient(running.url).post('/api/auth/logout')).status).toBe(204)
  })
})

describe('profile update', () => {
  it('changes the signed-in user’s display name', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    const response = await client.patch<UserBody>('/api/users/me', { name: '  Alex   Carter ' })
    expect(response.status).toBe(200)
    expect(response.body.user.name).toBe('Alex Carter')
    expect((await client.get<UserBody>('/api/auth/me')).body.user.name).toBe('Alex Carter')
  })

  it('requires a session', async () => {
    expect((await createClient(running.url).patch('/api/users/me', { name: 'X' })).status).toBe(401)
  })

  it('rejects anything but the name (email, password, ids)', async () => {
    fresh()
    await client.post('/api/auth/register', validRegistration())
    for (const body of [{ name: 'X', email: 'evil@example.com' }, { passwordHash: 'x' }, { _id: 'x', name: 'X' }]) {
      expect((await client.patch('/api/users/me', body)).status).toBe(400)
    }
    expect((await client.get<UserBody>('/api/auth/me')).body.user).toMatchObject({ email: 'alex@example.com', name: 'Alex' })
  })
})

describe('secure cookies (production settings)', () => {
  it('uses the __Host- prefix with Secure, and ignores the development cookie name', async () => {
    const secure = await startTestApp({ secureCookies: true, authRateLimits: noAuthLimits })
    try {
      const c = createClient(secure.url)
      const response = await c.post('/api/auth/register', validRegistration())
      expect(response.setCookies[0]).toMatch(/^__Host-fa_session=[A-Za-z0-9_-]{43};/)
      expect(response.setCookies[0]).toMatch(/; Secure/)
      expect(response.setCookies[0]).toMatch(/; HttpOnly/i)
      expect(response.setCookies[0]).toMatch(/; SameSite=Strict/i)
      expect(response.setCookies[0]).not.toMatch(/Domain=/i)

      const token = c.jar.get('__Host-fa_session')!
      expect((await createClient(secure.url).get('/api/auth/me', { Cookie: `fa_session=${token}` })).status).toBe(401)
      expect((await createClient(secure.url).get('/api/auth/me', { Cookie: `__Host-fa_session=${token}` })).status).toBe(200)
    } finally {
      await secure.close()
    }
  })
})
