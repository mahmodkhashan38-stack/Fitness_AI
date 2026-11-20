import { Types } from 'mongoose'
import { SESSION_TTL_MS } from '../auth/cookies.js'
import { hashPassword, needsRehash, verifyAgainstDummyHash, verifyPassword } from '../auth/password.js'
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from '../auth/session-token.js'
import type { LoginInput, ProfileUpdateInput, RegistrationInput } from '../auth/validation.js'
import { SessionModel } from '../models/session.js'
import { toPublicUser, UserModel, type PublicUser } from '../models/user.js'
import { HttpError } from '../utils/http-error.js'

export interface SessionResult {
  user: PublicUser
  /** Raw token for the cookie. Never stored or logged. */
  token: string
}

/** Same response for unknown email and wrong password, so login never reveals which accounts exist. */
export const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.'

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
}

async function createSession(userId: Types.ObjectId): Promise<string> {
  const token = generateSessionToken()
  await SessionModel.create({ tokenHash: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
  return token
}

/** Deletes the session behind a cookie value, if any. Used on logout and before issuing a new session. */
export async function endSession(token: string | undefined): Promise<void> {
  if (!token || !isWellFormedSessionToken(token)) return
  await SessionModel.deleteOne({ tokenHash: hashSessionToken(token) })
}

export async function register(input: RegistrationInput, previousToken?: string): Promise<SessionResult> {
  const passwordHash = await hashPassword(input.password)
  let user
  try {
    user = await UserModel.create({ email: input.email, name: input.name, passwordHash })
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Log in instead.', {
        fields: { email: 'An account with this email already exists.' },
      })
    }
    throw error
  }
  await endSession(previousToken)
  return { user: toPublicUser(user), token: await createSession(user._id) }
}

export async function login(input: LoginInput, previousToken?: string): Promise<SessionResult> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash')
  const valid = user ? await verifyPassword(user.passwordHash, input.password) : await verifyAgainstDummyHash(input.password)
  if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE)

  if (needsRehash(user.passwordHash)) {
    await UserModel.updateOne({ _id: user._id }, { passwordHash: await hashPassword(input.password) })
  }
  // A new session on every login: a token planted before login (session fixation) is never upgraded.
  await endSession(previousToken)
  return { user: toPublicUser(user), token: await createSession(user._id) }
}

export interface AuthenticatedSession {
  user: PublicUser
  userId: Types.ObjectId
}

/** Resolves a cookie token to its user, or null if the token is unknown, expired or its user no longer exists. */
export async function findSessionUser(token: string | undefined): Promise<AuthenticatedSession | null> {
  if (!token || !isWellFormedSessionToken(token)) return null
  const session = await SessionModel.findOne({ tokenHash: hashSessionToken(token), expiresAt: { $gt: new Date() } }).lean()
  if (!session) return null
  const user = await UserModel.findById(session.userId).lean()
  if (!user) {
    await SessionModel.deleteOne({ _id: session._id })
    return null
  }
  return { user: toPublicUser(user), userId: user._id }
}

/** Updates the authenticated user's own profile. The user id always comes from the session, never from the request. */
export async function updateProfile(userId: Types.ObjectId, input: ProfileUpdateInput): Promise<PublicUser> {
  const user = await UserModel.findOneAndUpdate({ _id: userId }, { name: input.name }, { new: true, runValidators: true }).lean()
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.')
  return toPublicUser(user)
}
