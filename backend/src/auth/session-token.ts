import { createHash, randomBytes } from 'node:crypto'

/** 32 random bytes → 43 base64url characters (256 bits). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function isWellFormedSessionToken(value: string): boolean {
  return TOKEN_PATTERN.test(value)
}

/**
 * Only this digest is stored. A leaked sessions collection does not contain usable cookies.
 * (A fast hash is fine here: the token has 256 bits of entropy, unlike a password.)
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
