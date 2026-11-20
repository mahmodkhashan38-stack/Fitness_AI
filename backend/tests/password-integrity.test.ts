/**
 * Password integrity: no truncation, normalisation, encoding or verification quirk may let a
 * password other than the registered one authenticate (FIT-11 security review).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/auth/password.js'
import { hasLoneSurrogate, normalisePassword, parseLogin, parseRegistration } from '../src/auth/validation.js'
import { HttpError } from '../src/utils/http-error.js'
import { createClient, validProfile } from './support/client.js'
import { startTestDatabase } from './support/mongo.js'
import { startTestApp, type RunningServer } from './helpers.js'

const PASSWORD_128 = 'correct horse battery staple '.repeat(5).slice(0, 128)
const PASSWORD_120 = PASSWORD_128.slice(0, 120)

describe('hashing primitives', () => {
  it.each([
    ['128 chars vs 127-char prefix', PASSWORD_128, PASSWORD_128.slice(0, 127)],
    ['128 chars vs last character changed', PASSWORD_128, `${PASSWORD_128.slice(0, 127)}X`],
    ['120 chars vs 119-char prefix', PASSWORD_120, PASSWORD_120.slice(0, 119)],
    ['120 chars vs 121 chars', PASSWORD_120, `${PASSWORD_120}x`],
    ['73 bytes vs 72-byte prefix (bcrypt truncation point)', 'a'.repeat(73), 'a'.repeat(72)],
    ['NUL inside vs text before NUL', 'secret-part\u0000rest-of-it', 'secret-part'],
    ['emoji vs half an emoji', 'passphrase 💪💪💪', 'passphrase 💪💪'],
    ['case differs', 'Correct Horse Battery', 'correct horse battery'],
    ['trailing space differs', 'correct horse battery ', 'correct horse battery'],
  ])('rejects: %s', async (_label, registered, attempt) => {
    expect(registered).not.toBe(attempt)
    expect(await verifyPassword(await hashPassword(registered), attempt)).toBe(false)
  })

  it('documents why lone surrogates are refused: UTF-8 encoding maps them all to U+FFFD', () => {
    expect(Buffer.from('x\ud800').equals(Buffer.from('x\udbff'))).toBe(true)
    expect(Buffer.from('x\ud800').equals(Buffer.from('x�'))).toBe(true)
  })
})

describe('input rules', () => {
  it('detects lone surrogates but accepts real emoji', () => {
    expect(hasLoneSurrogate('abc\ud800')).toBe(true)
    expect(hasLoneSurrogate('\udc00abc')).toBe(true)
    expect(hasLoneSurrogate('💪 passphrase')).toBe(false)
  })

  it('normalises with NFKC only (no trimming, case folding or truncation)', () => {
    expect(normalisePassword('café')).toBe('café')
    expect(normalisePassword('  MiXeD  ')).toBe('  MiXeD  ')
    expect(normalisePassword(PASSWORD_128)).toBe(PASSWORD_128)
  })

  it('registration refuses lone surrogates with a field error', () => {
    try {
      parseRegistration({ email: 'a@b.co', name: 'A', password: 'long enough password\ud800', profile: validProfile() })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).fields).toEqual({ password: 'Your password contains unsupported characters.' })
    }
  })

  it('login treats lone surrogates as wrong credentials (no hashing, no hint)', () => {
    expect(() => parseLogin({ email: 'a@b.co', password: 'x\ud800' })).toThrow(expect.objectContaining({ status: 401, code: 'INVALID_CREDENTIALS' }))
  })

  it('length limits apply after normalisation', () => {
    // 11 decomposed characters are 22 UTF-16 units but 11 characters after NFKC.
    expect(() => parseRegistration({ email: 'a@b.co', name: 'A', password: 'é'.repeat(11), profile: validProfile() })).toThrow(HttpError)
    expect(parseRegistration({ email: 'a@b.co', name: 'A', password: 'é'.repeat(12), profile: validProfile() }).password).toBe('é'.repeat(12))
  })
})

describe('end to end (real MongoDB)', () => {
  let db: Awaited<ReturnType<typeof startTestDatabase>>
  let running: RunningServer
  const generous = { windowMs: 60_000, limit: 10_000 }

  beforeAll(async () => {
    db = await startTestDatabase()
    running = await startTestApp({ rateLimit: generous, authRateLimits: { register: generous, loginPerIp: generous, loginPerEmail: generous } })
  })
  afterAll(async () => {
    await running.close()
    await db.stop()
  })
  afterEach(async () => {
    await db.clear()
  })

  const register = (password: string, email = 'alex@example.com') =>
    createClient(running.url).post('/api/auth/register', { email, password, name: 'Alex', profile: validProfile() }).then((r) => r.status)
  const login = (password: string, email = 'alex@example.com') =>
    createClient(running.url).post('/api/auth/login', { email, password }).then((r) => r.status)

  it.each([
    ['120', PASSWORD_120],
    ['128', PASSWORD_128],
  ])('a %s-character password: only the exact password logs in', async (_length, password) => {
    expect(await register(password)).toBe(201)
    expect(await login(password)).toBe(200)
    for (const attempt of [
      password.slice(0, -1),
      password.slice(0, 72),
      `${password.slice(0, -1)}X`,
      `${password}x`,
      `${password}\u0000`,
      password.toUpperCase(),
      ` ${password}`,
    ]) {
      expect(await login(attempt), JSON.stringify(attempt.slice(-8))).toBe(401)
    }
  })

  it('a password with a lone surrogate can neither be registered nor matched by another one', async () => {
    expect(await register('long enough password\ud800')).toBe(400)
    expect(await register('long enough password�')).toBe(201)
    // Would collide with U+FFFD if it reached the hash.
    expect(await login('long enough password\ud800')).toBe(401)
    expect(await login('long enough password\udbff')).toBe(401)
    expect(await login('long enough password�')).toBe(200)
  })

  it('composed and decomposed forms of the same text log in alike (NFKC)', async () => {
    expect(await register('café au lait every morning')).toBe(201)
    expect(await login('café au lait every morning')).toBe(200)
    expect(await login('cafe au lait every morning')).toBe(401)
  })
})
