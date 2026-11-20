import { describe, expect, it } from 'vitest'
import { parseCookies, sessionCookieName } from '../src/auth/cookies.js'
import { hashPassword, needsRehash, verifyAgainstDummyHash, verifyPassword } from '../src/auth/password.js'
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from '../src/auth/session-token.js'
import { normaliseEmail, parseLogin, parseProfileUpdate, parseRegistration } from '../src/auth/validation.js'
import { HttpError } from '../src/utils/http-error.js'

describe('session tokens', () => {
  it('are 256-bit, URL-safe and unique', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateSessionToken))
    expect(tokens.size).toBe(1000)
    for (const token of tokens) expect(isWellFormedSessionToken(token)).toBe(true)
  })

  it('are stored as a SHA-256 digest', () => {
    expect(hashSessionToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it.each(['', 'short', 'A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}=`, `${'A'.repeat(42)}/`])('rejects malformed token %j', (value) => {
    expect(isWellFormedSessionToken(value)).toBe(false)
  })
})

describe('passwords', () => {
  it('hash with Argon2id (OWASP parameters), verify, and never throw on bad hashes', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true)
    expect(await verifyPassword(hash, 'correct horse battery stapl')).toBe(false)
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false)
    expect(needsRehash(hash)).toBe(false)
    expect(await verifyAgainstDummyHash('anything')).toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same password here')).not.toBe(await hashPassword('same password here'))
  })
})

describe('cookies', () => {
  it('parses the Cookie header', () => {
    const cookies = parseCookies('a=1; fa_session=abc; theme="dark"; bad; =x; enc=%20y')
    expect(Object.fromEntries(cookies)).toEqual({ a: '1', fa_session: 'abc', theme: 'dark', enc: ' y' })
  })

  it('keeps the first occurrence and ignores undecodable values', () => {
    expect(parseCookies('a=1; a=2').get('a')).toBe('1')
    expect(parseCookies('a=%E0%A4%A').has('a')).toBe(false)
    expect(parseCookies(undefined).size).toBe(0)
  })

  it('uses the __Host- prefix only with Secure', () => {
    expect(sessionCookieName(true)).toBe('__Host-fa_session')
    expect(sessionCookieName(false)).toBe('fa_session')
  })
})

describe('validation', () => {
  const fieldsOf = (fn: () => unknown) => {
    try {
      fn()
    } catch (error) {
      if (error instanceof HttpError) return { status: error.status, fields: error.fields, message: error.message }
      throw error
    }
    throw new Error('expected HttpError')
  }

  it('normalises email addresses', () => {
    expect(normaliseEmail('  Alex@Example.COM ')).toBe('alex@example.com')
    expect(normaliseEmail('Émile@example.com')).toBe(normaliseEmail('Émile@example.com'))
  })

  it('accepts valid registration and tidies the name', () => {
    expect(parseRegistration({ email: 'a@b.co', password: 'twelve chars', name: '  Ana   Maria ' })).toEqual({
      email: 'a@b.co',
      password: 'twelve chars',
      name: 'Ana Maria',
    })
  })

  it.each([null, [], 'string', 42])('rejects a non-object body %j', (body) => {
    expect(fieldsOf(() => parseRegistration(body)).status).toBe(400)
  })

  it('rejects control characters in names', () => {
    expect(fieldsOf(() => parseProfileUpdate({ name: 'Bad\u0000Name' })).fields).toEqual({ name: 'Remove unsupported characters.' })
  })

  it('accepts exactly 12 and 128 character passwords', () => {
    expect(() => parseRegistration({ email: 'a@b.co', password: 'x'.repeat(12), name: 'A' })).not.toThrow()
    expect(() => parseRegistration({ email: 'a@b.co', password: 'x'.repeat(128), name: 'A' })).not.toThrow()
    expect(fieldsOf(() => parseRegistration({ email: 'a@b.co', password: 'x'.repeat(11), name: 'A' })).fields).toHaveProperty('password')
  })

  it('login only requires non-empty strings', () => {
    expect(parseLogin({ email: ' A@B.co ', password: ' p ' })).toEqual({ email: 'a@b.co', password: ' p ' })
    expect(fieldsOf(() => parseLogin({ email: 1, password: null })).fields).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    })
  })
})
