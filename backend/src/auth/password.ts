import argon2 from 'argon2'

/**
 * Argon2id with the OWASP Password Storage Cheat Sheet minimum: 19 MiB memory, 2 iterations,
 * parallelism 1. Salt (16 bytes) and parameters are stored in the encoded hash, so parameters
 * can be raised later; `needsRehash` then upgrades hashes at the next successful login.
 */
export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS)
}

export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, PASSWORD_HASH_OPTIONS)
}

/** Returns false (never throws) for a malformed hash, so a corrupt record can't cause a 500 or a timing difference. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | undefined

/**
 * Verifies against a throwaway hash so that "unknown email" takes as long as "wrong password"
 * and response timing doesn't reveal which accounts exist.
 */
export async function verifyAgainstDummyHash(password: string): Promise<false> {
  dummyHash ??= hashPassword('fitness-ai-timing-equaliser-not-a-real-password')
  await verifyPassword(await dummyHash, password)
  return false
}
