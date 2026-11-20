import { HttpError } from '../utils/http-error.js'

export const PASSWORD_MIN_LENGTH = 12
/** Generous but bounded: Argon2 handles long inputs, and passwords are never truncated. */
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 254
export const NAME_MAX_LENGTH = 60

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export interface RegistrationInput {
  email: string
  password: string
  name: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface ProfileUpdateInput {
  name: string
}

/**
 * Unpaired UTF-16 surrogates (only reachable through crafted JSON escapes such as "\ud800")
 * are converted to U+FFFD when the string is encoded as UTF-8 for hashing, so different
 * passwords would produce the same hash. Such passwords are refused. (With the `u` flag,
 * valid surrogate pairs such as emoji count as one code point and do not match.)
 */
const LONE_SURROGATE = /[\uD800-\uDFFF]/u

export function hasLoneSurrogate(value: string): boolean {
  return LONE_SURROGATE.test(value)
}

/**
 * Passwords are compared after NFKC normalisation (NIST SP 800-63B), so the same text typed on
 * keyboards that produce composed (é) or decomposed (e + ◌́) characters logs in alike. Nothing
 * else changes: no trimming, no case folding, no truncation.
 */
export function normalisePassword(password: string): string {
  return password.normalize('NFKC')
}

/** Lower-case, trimmed, Unicode-normalised email used for storage and lookup. */
export function normaliseEmail(email: string): string {
  return email.normalize('NFC').trim().toLowerCase()
}

function invalid(fields: Record<string, string>): HttpError {
  return new HttpError(400, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', { fields })
}

/** The body must be a plain object containing exactly the allowed keys (unknown keys, e.g. "id" or "role", are rejected). */
function readObject(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Request body must be a JSON object.')
  }
  const unknownKeys = Object.keys(body).filter((key) => !allowed.includes(key))
  if (unknownKeys.length > 0) {
    throw new HttpError(400, 'VALIDATION_FAILED', `Unexpected field: ${unknownKeys[0]!.slice(0, 40)}.`)
  }
  return body as Record<string, unknown>
}

function validateEmail(value: unknown, fields: Record<string, string>): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fields.email = 'Enter your email address.'
    return ''
  }
  const email = normaliseEmail(value)
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) fields.email = 'Enter a valid email address.'
  return email
}

function validateName(value: unknown, fields: Record<string, string>): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fields.name = 'Enter your name.'
    return ''
  }
  const name = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (name.length > NAME_MAX_LENGTH) fields.name = `Use at most ${NAME_MAX_LENGTH} characters.`
  else if (CONTROL_CHARACTERS.test(name)) fields.name = 'Remove unsupported characters.'
  return name
}

export function parseRegistration(body: unknown): RegistrationInput {
  const data = readObject(body, ['email', 'password', 'name'])
  const fields: Record<string, string> = {}
  const email = validateEmail(data.email, fields)
  const name = validateName(data.name, fields)

  const raw = data.password
  const password = typeof raw === 'string' && !hasLoneSurrogate(raw) ? normalisePassword(raw) : raw
  if (typeof password !== 'string' || password === '') {
    fields.password = 'Create a password.'
  } else if (hasLoneSurrogate(password)) {
    fields.password = 'Your password contains unsupported characters.'
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    fields.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    fields.password = `Use at most ${PASSWORD_MAX_LENGTH} characters.`
  } else if (!fields.email && normaliseEmail(password) === email) {
    fields.password = 'Your password can’t be your email address.'
  }

  if (Object.keys(fields).length > 0) throw invalid(fields)
  return { email, password: password as string, name }
}

/**
 * Login only checks types and presence. Format and length problems are reported as the
 * same generic "incorrect" error as a wrong password, so the response never hints at
 * what the stored account looks like.
 */
export function parseLogin(body: unknown): LoginInput {
  const data = readObject(body, ['email', 'password'])
  const fields: Record<string, string> = {}
  if (typeof data.email !== 'string' || data.email.trim() === '') fields.email = 'Enter your email address.'
  if (typeof data.password !== 'string' || data.password === '') fields.password = 'Enter your password.'
  if (Object.keys(fields).length > 0) throw invalid(fields)
  // No stored password can contain a lone surrogate, and verifying one would collide (see above).
  if (hasLoneSurrogate(data.password as string)) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }
  return { email: normaliseEmail(data.email as string), password: normalisePassword(data.password as string) }
}

export function parseProfileUpdate(body: unknown): ProfileUpdateInput {
  const data = readObject(body, ['name'])
  const fields: Record<string, string> = {}
  const name = validateName(data.name, fields)
  if (Object.keys(fields).length > 0) throw invalid(fields)
  return { name }
}
