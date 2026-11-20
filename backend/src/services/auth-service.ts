import mongoose, { Types } from 'mongoose'
import { SESSION_TTL_MS } from '../auth/cookies.js'
import { hashPassword, needsRehash, verifyAgainstDummyHash, verifyPassword } from '../auth/password.js'
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from '../auth/session-token.js'
import type { LoginInput, ProfileUpdateInput, RegistrationInput } from '../auth/validation.js'
import { FitnessProfileModel } from '../models/fitness-profile.js'
import { SessionModel } from '../models/session.js'
import { toPublicUser, UserModel, type PublicUser } from '../models/user.js'
import { HttpError } from '../utils/http-error.js'
import { isDuplicateKeyError } from '../utils/mongo-errors.js'
import { hasFitnessProfile } from './fitness-profile-service.js'

export interface SessionResult {
  user: PublicUser
  /** Raw token for the cookie. Never stored or logged. */
  token: string
}

/** Same response for unknown email and wrong password, so login never reveals which accounts exist. */
export const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.'

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

/**
 * Creates the account and its fitness profile atomically (FIT-12): both documents are written in
 * one MongoDB transaction, so a failure at any point (duplicate email, validation, lost connection)
 * leaves neither behind and the email stays free for a retry. Transient transaction errors are
 * retried by the driver (withTransaction). The login session is created only after the commit.
 *
 * Requires a replica set (MongoDB Atlas always is); server.ts refuses to start without one.
 */
export async function register(input: RegistrationInput, previousToken?: string): Promise<SessionResult> {
  const passwordHash = await hashPassword(input.password)
  const onboardingCompletedAt = new Date()
  let user
  try {
    user = await mongoose.connection.transaction(async (session) => {
      const [created] = await UserModel.create([{ email: input.email, name: input.name, passwordHash }], { session })
      await FitnessProfileModel.create([{ ...input.profile, userId: created!._id, onboardingCompletedAt }], { session })
      return created!
    })
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Log in instead.', {
        fields: { email: 'An account with this email already exists.' },
      })
    }
    throw error
  }
  await endSession(previousToken)
  return { user: toPublicUser(user, true), token: await createSession(user._id) }
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
  return { user: toPublicUser(user, await hasFitnessProfile(user._id)), token: await createSession(user._id) }
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
  const [user, onboardingCompleted] = await Promise.all([UserModel.findById(session.userId).lean(), hasFitnessProfile(session.userId)])
  if (!user) {
    await SessionModel.deleteOne({ _id: session._id })
    return null
  }
  return { user: toPublicUser(user, onboardingCompleted), userId: user._id }
}

/** Updates the authenticated user's own account details. The user id always comes from the session, never from the request. */
export async function updateProfile(session: AuthenticatedSession, input: ProfileUpdateInput): Promise<PublicUser> {
  const user = await UserModel.findOneAndUpdate(
    { _id: session.userId },
    { name: input.name },
    { returnDocument: 'after', runValidators: true },
  ).lean()
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.')
  return toPublicUser(user, session.user.onboardingCompleted)
}
